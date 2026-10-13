import { setTimeout as sleep } from "node:timers/promises";
import { limitsFor } from "@localman/shared";
import { type Logger, createLogger } from "../../logger.js";
import { acrossTenants, runInTenant } from "../../tenancy/tenant-context.js";
import { tenantDirectory } from "../../tenancy/tenant-directory.js";
import { storedTenantId } from "../../tenancy/tenant-scope-plugin.js";
import { effectivePlan } from "../billing/plan-guard.js";
import type { UsageMeter } from "../mock-runtime/usage-meter.js";
import type { JobProject } from "./job-project.js";
import { OwnerSlots, claimDueJob, takeExpiredJob } from "./outbound-claims.js";
import {
	OutboundJobModel,
	type StoredOutboundJob,
} from "./outbound-job-model.js";
import { expireOutboundJob, runOutboundJob } from "./outbound-job-run.js";
import { type OutboundDeps, defaultOutboundDeps } from "./outbound-send.js";
import {
	configureOutboundTracking,
	settleTracked,
} from "./outbound-tracking.js";

export interface OutboundQueueOptions {
	readonly deps?: OutboundDeps;
	readonly pollMs?: number;
	/** Deliveries in flight in the process, and per project owner. */
	readonly concurrency?: number;
	readonly perOwner?: number;
	/** Monthly quota of the owners; jobs are not charged without one. */
	readonly meter?: UsageMeter;
}

/** A running job is taken again this long after its attempt's deadline. */
const LOCK_MARGIN_MS = 30_000;
/** Jobs past their deadline settled per poll at most. */
const EXPIRE_PER_POLL = 50;

/**
 * Worker of `outbound_jobs` (inbox forwards and mock callbacks). Each poll
 * settles jobs past their deadline as `expired`, then claims due jobs: at
 * most `concurrency` in flight and `perOwner` per project owner, so one
 * account's dead targets hold two slots, never the queue. A claimed job
 * makes one attempt (`runOutboundJob`; the first charges the owner's
 * quota); one worth retrying is due again after its backoff, up to 3
 * attempts, then settled (log line, last result) and deleted. A job left
 * `running` by a dead process is claimed again once its lock expires.
 * `stop` claims nothing more, aborts what is in flight and puts it back.
 * Jobs of every tenant share the queue; each runs in its own tenant.
 */
export class OutboundQueue {
	private readonly deps: OutboundDeps;
	private readonly pollMs: number;
	private readonly concurrency: number;
	private readonly perOwner: number;
	private meter: UsageMeter | undefined;
	private readonly inflight = new Set<Promise<void>>();
	private readonly slots = new OwnerSlots();
	private abort = new AbortController();
	private timer: NodeJS.Timeout | undefined;
	private polling: Promise<void> | undefined;
	private logger: Logger = createLogger("silent");

	constructor(options: OutboundQueueOptions = {}) {
		this.deps = options.deps ?? defaultOutboundDeps();
		this.pollMs = options.pollMs ?? 1_000;
		this.concurrency = options.concurrency ?? 16;
		this.perOwner = options.perOwner ?? 2;
		this.meter = options.meter;
	}

	/** Installed by `main.ts`: the logger and the owners' quota meter. */
	configure(logger: Logger, meter: UsageMeter): void {
		this.logger = logger;
		this.meter = meter;
		configureOutboundTracking(logger);
	}

	/** Polls every `pollMs` until `stop`. */
	start(): void {
		if (this.timer) return;
		this.abort = new AbortController();
		this.timer = setInterval(() => void this.poll(), this.pollMs);
		this.timer.unref();
	}

	/** Expires and claims due jobs; concurrent calls share one pass. */
	poll(): Promise<void> {
		this.polling ??= this.fill()
			.catch((error: unknown) => {
				this.logger.error({ err: error }, "Outbound queue poll failed");
			})
			.finally(() => {
				this.polling = undefined;
			});
		return this.polling;
	}

	private async fill(): Promise<void> {
		for (let i = 0; i < EXPIRE_PER_POLL && !this.abort.signal.aborted; i++) {
			const job = await takeExpiredJob();
			if (!job) break;
			// A tenant the IdP cannot name now must not stop the other jobs.
			await this.inTenantOf(job, () =>
				expireOutboundJob(job, this.logger),
			).catch((error: unknown) => {
				this.logger.error({ err: error }, "Expiring an outbound job failed");
			});
		}
		while (
			!this.abort.signal.aborted &&
			this.inflight.size < this.concurrency
		) {
			const lockedUntil = new Date(
				Date.now() + this.deps.timeoutMs + LOCK_MARGIN_MS,
			);
			const job = await claimDueJob(
				this.slots.busy(this.perOwner),
				lockedUntil,
			);
			if (!job) return;
			this.launch(job);
		}
	}

	private charge = (project: JobProject): Promise<boolean> => {
		if (!this.meter) return Promise.resolve(true);
		const plan = effectivePlan(project.ownerPlan);
		const limit = limitsFor(plan).mockRequestsPerMonth;
		return this.meter.admit(project.owner, limit, project.id.toHexString());
	};

	/** Runs `work` in the job's tenant; a job of no known tenant is skipped. */
	private async inTenantOf(
		job: StoredOutboundJob,
		work: () => Promise<void>,
	): Promise<void> {
		const tenant = await tenantDirectory().byId(storedTenantId(job));
		if (tenant) return runInTenant(tenant, work);
		this.logger.warn({ jobId: job._id }, "Outbound job of an unknown tenant");
	}

	private launch(job: StoredOutboundJob): void {
		const release = this.slots.take({
			tenantId: storedTenantId(job),
			owner: job.owner,
		});
		const context = {
			deps: this.deps,
			signal: this.abort.signal,
			logger: this.logger,
			charge: this.charge,
		};
		const run: Promise<void> = this.inTenantOf(job, () =>
			runOutboundJob(job, context),
		)
			.catch((error: unknown) => {
				this.logger.error({ err: error }, "Outbound delivery failed");
			})
			.finally(() => {
				this.inflight.delete(run);
				release();
			});
		this.inflight.add(run);
	}

	/**
	 * TEST ONLY. Polls until no job is left (backoffs included), at most
	 * `timeoutMs`.
	 */
	async drain(timeoutMs = 10_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			await settleTracked();
			await this.poll();
			await Promise.allSettled([...this.inflight]);
			const left = await acrossTenants(() =>
				OutboundJobModel.countDocuments().exec(),
			);
			if (left === 0) return;
			await sleep(Math.min(this.pollMs, 20));
		}
		throw new Error("The outbound queue did not drain in time");
	}

	/**
	 * Shutdown: no job is claimed any more, attempts in flight are aborted
	 * and put back, then enqueues still being written finish.
	 */
	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		this.abort.abort();
		await this.polling;
		await Promise.allSettled([...this.inflight]);
		await settleTracked();
	}
}

/** The process's queue: configured, started and stopped by `main.ts`. */
export const outboundQueue = new OutboundQueue();
