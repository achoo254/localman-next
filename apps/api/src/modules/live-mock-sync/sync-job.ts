import { Types } from "mongoose";
import type { Logger } from "../../logger.js";
import {
	type LocalmanTenant,
	runInTenant,
} from "../../tenancy/tenant-context.js";
import { onResourceChanged } from "../resources/resource-events.js";
import { SyncLinkModel } from "./sync-link-model.js";
import { syncLink } from "./sync-service.js";

/** Changes this close together become one sync (one changelog entry). */
export const SYNC_DEBOUNCE_MS = 2_000;
/** A steady stream of changes still syncs at least this often. */
export const SYNC_MAX_WAIT_MS = 10_000;
/** A failed sync is tried once more after this. */
export const SYNC_RETRY_MS = 30_000;

/**
 * Syncs every collection linked to the project, one after another;
 * resolves `false` when one of them failed.
 */
export async function syncProject(
	projectId: string,
	logger: Logger,
): Promise<boolean> {
	const links = await SyncLinkModel.find(
		{ projectId: new Types.ObjectId(projectId) },
		{ _id: 1 },
	).lean<{ _id: Types.ObjectId }[]>();
	let ok = true;
	for (const link of links) {
		try {
			await syncLink(link._id);
		} catch (error) {
			// Too large, a lock timeout…: tried again later.
			ok = false;
			logger.error(
				{ err: error, linkId: link._id.toHexString() },
				"Live Mock Sync failed",
			);
		}
	}
	return ok;
}

interface Pending {
	readonly tenant: LocalmanTenant;
	readonly projectId: string;
	readonly timer: NodeJS.Timeout;
	/** When the burst began (`SYNC_MAX_WAIT_MS` counts from there). */
	readonly since: number;
	/** A retry after a failure (not retried again). */
	readonly retry: boolean;
}

/**
 * Listens to `resource.changed` and syncs the project's collections
 * `SYNC_DEBOUNCE_MS` after the last change of a burst, and at least every
 * `SYNC_MAX_WAIT_MS` during a long one; a failed sync is tried once more
 * after `SYNC_RETRY_MS`. Timers are `unref`; `stop` runs what is pending
 * at once and waits for it (shutdown, before Mongo closes).
 */
export class LiveMockSyncJob {
	private readonly pending = new Map<string, Pending>();
	private readonly running = new Set<Promise<void>>();
	private unsubscribe: (() => void) | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly delayMs = SYNC_DEBOUNCE_MS,
		private readonly maxWaitMs = SYNC_MAX_WAIT_MS,
	) {}

	start(): void {
		this.unsubscribe ??= onResourceChanged(({ tenant, projectId }) =>
			this.schedule(tenant, projectId),
		);
	}

	private schedule(
		tenant: LocalmanTenant,
		projectId: string,
		retry = false,
	): void {
		const key = `${tenant.id}:${projectId}`;
		const before = this.pending.get(key);
		// A change already waiting syncs sooner than the retry would.
		if (retry && before) return;
		if (before) clearTimeout(before.timer);
		const now = Date.now();
		const since = before?.since ?? now;
		const wait = retry
			? SYNC_RETRY_MS
			: Math.max(0, Math.min(this.delayMs, since + this.maxWaitMs - now));
		const timer = setTimeout(() => this.run(key), wait);
		timer.unref();
		this.pending.set(key, { tenant, projectId, timer, since, retry });
	}

	private run(key: string): void {
		const due = this.pending.get(key);
		if (!due) return;
		this.pending.delete(key);
		clearTimeout(due.timer);
		const work = runInTenant(due.tenant, () =>
			syncProject(due.projectId, this.logger),
		)
			.then((ok) => {
				if (!ok && !due.retry && this.unsubscribe) {
					this.schedule(due.tenant, due.projectId, true);
				}
			})
			.finally(() => this.running.delete(work));
		this.running.add(work);
	}

	/** Runs every pending sync now and waits for all running ones. */
	async flush(): Promise<void> {
		for (const key of [...this.pending.keys()]) this.run(key);
		await Promise.allSettled([...this.running]);
	}

	async stop(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		await this.flush();
	}
}
