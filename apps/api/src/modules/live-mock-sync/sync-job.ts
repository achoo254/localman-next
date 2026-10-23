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

/** Syncs every collection linked to the project, one after another. */
export async function syncProject(
	projectId: string,
	logger: Logger,
): Promise<void> {
	const links = await SyncLinkModel.find(
		{ projectId: new Types.ObjectId(projectId) },
		{ _id: 1 },
	).lean<{ _id: Types.ObjectId }[]>();
	for (const link of links) {
		try {
			await syncLink(link._id);
		} catch (error) {
			// Too large, a lock timeout…: the next change of the mock retries.
			logger.error(
				{ err: error, linkId: link._id.toHexString() },
				"Live Mock Sync failed",
			);
		}
	}
}

interface Pending {
	readonly tenant: LocalmanTenant;
	readonly projectId: string;
	readonly timer: NodeJS.Timeout;
}

/**
 * Listens to `resource.changed` and syncs the project's collections
 * `SYNC_DEBOUNCE_MS` after the last change of a burst. Timers are `unref`;
 * `stop` runs what is pending at once and waits for it (shutdown, before
 * Mongo closes), so no change is left unsynced.
 */
export class LiveMockSyncJob {
	private readonly pending = new Map<string, Pending>();
	private readonly running = new Set<Promise<void>>();
	private unsubscribe: (() => void) | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly delayMs = SYNC_DEBOUNCE_MS,
	) {}

	start(): void {
		this.unsubscribe ??= onResourceChanged(({ tenant, projectId }) =>
			this.schedule(tenant, projectId),
		);
	}

	private schedule(tenant: LocalmanTenant, projectId: string): void {
		const key = `${tenant.id}:${projectId}`;
		const before = this.pending.get(key);
		if (before) clearTimeout(before.timer);
		const timer = setTimeout(() => this.run(key), this.delayMs);
		timer.unref();
		this.pending.set(key, { tenant, projectId, timer });
	}

	private run(key: string): void {
		const due = this.pending.get(key);
		if (!due) return;
		this.pending.delete(key);
		clearTimeout(due.timer);
		const work = runInTenant(due.tenant, () =>
			syncProject(due.projectId, this.logger),
		).finally(() => this.running.delete(work));
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
