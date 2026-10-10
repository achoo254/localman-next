import { setTimeout as sleep } from "node:timers/promises";
import { limitsFor } from "@localman/shared";
import { type Logger, createLogger } from "../../logger.js";
import { effectivePlan } from "../billing/plan-guard.js";
import type { UsageMeter } from "../mock-runtime/usage-meter.js";
import type { JobProject } from "./job-project.js";
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
 */
export class OutboundQueue {
	private readonly deps: OutboundDeps;
	private readonly pollMs: number;
	private readonly concurrency: number;
	private readonly perOwner: number;
	private meter: UsageMeter | undefined;
	private readonly inflight = new Set<Promise<void>>();
	private readonly running = new Map<string, number>();
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
			const job = await this.takeExpired();
			if (!job) break;
			await expireOutboundJob(job, this.logger);
		}
		while (
			!this.abort.signal.aborted &&
			this.inflight.size < this.concurrency
		) {
			const job = await this.claim();
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

	private launch(job: StoredOutboundJob): void {
		const key = job.owner;
		this.running.set(key, (this.running.get(key) ?? 0) + 1);
		const context = {
			deps: this.deps,
			signal: this.abort.signal,
			logger: this.logger,
			charge: this.charge,
		};
		const run: Promise<void> = runOutboundJob(job, context)
			.catch((error: unknown) => {
				this.logger.error({ err: error }, "Outbound delivery failed");
			})
			.finally(() => {
				this.inflight.delete(run);
				const left = (this.running.get(key) ?? 1) - 1;
				if (left > 0) this.running.set(key, left);
				else this.running.delete(key);
			});
		this.inflight.add(run);
	}

	/** Takes (deletes) one job past its deadline that no worker holds. */
	private takeExpired(): Promise<StoredOutboundJob | null> {
		const now = new Date();
		return OutboundJobModel.findOneAndDelete({
			deadlineAt: { $lte: now },
			$or: [{ state: "pending" }, { lockedUntil: { $lte: now } }],
		}).lean<StoredOutboundJob>();
	}

	private claim(): Promise<StoredOutboundJob | null> {
		const now = new Date();
		const busy = [...this.running]
			.filter(([, count]) => count >= this.perOwner)
			.map(([owner]) => owner);
		const lockedUntil = new Date(
			now.getTime() + this.deps.timeoutMs + LOCK_MARGIN_MS,
		);
		return OutboundJobModel.findOneAndUpdate(
			{
				$or: [
					{ state: "pending", nextAt: { $lte: now } },
					{ state: "running", lockedUntil: { $lte: now } },
				],
				deadlineAt: { $gt: now },
				...(busy.length > 0 ? { owner: { $nin: busy } } : {}),
			},
			{ $set: { state: "running", lockedUntil } },
			{ sort: { nextAt: 1 }, returnDocument: "after" },
		).lean<StoredOutboundJob>();
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
			if ((await OutboundJobModel.countDocuments()) === 0) return;
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
