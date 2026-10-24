import type { Logger } from "./logger.js";
import { backfillExampleSearchNames } from "./modules/collections/example-search-backfill.js";
import { CollectionTrashJob } from "./modules/collections/trash-purge-job.js";
import { LiveMockSyncJob } from "./modules/live-mock-sync/sync-job.js";
import { TombstoneSweeper } from "./modules/projects/tombstone-sweeper.js";
import { TrialReminderJob } from "./modules/trial/trial-reminders.js";
import { WatchDigestJob } from "./modules/watch/watch-digest-job.js";
import { runInPrimaryTenant } from "./tenancy/primary-tenant-job.js";

/**
 * The periodic jobs of the API process, started and stopped together.
 * Each run works in the primary tenant, the only one served.
 */
export interface BackgroundJobs {
	start(): void;
	/** Clears the timers and waits for running work (before Mongo closes). */
	stop(): Promise<void>;
}

export interface BackgroundJobOptions {
	/** Watch digests run only while comments and watch are served. */
	readonly watchDigest: boolean;
}

export function createBackgroundJobs(
	logger: Logger,
	options: BackgroundJobOptions,
): BackgroundJobs {
	// Finishes project deletions cut off by an error or a restart.
	const tombstoneSweeper = new TombstoneSweeper(logger);
	// Trial reminders (7 days, 1 day, ended), once per trial end.
	const trialReminders = new TrialReminderJob(logger);
	// Collections past their days in the trash are deleted for good.
	const collectionTrash = new CollectionTrashJob(logger);
	// Watchers hear about others' collection changes, about once a minute.
	const watchDigest = options.watchDigest ? new WatchDigestJob(logger) : null;
	// Collections linked to a mock follow its resources, 2 s after a change.
	const liveMockSync = new LiveMockSyncJob(logger);
	// Once per start: older examples get the folded name search uses.
	let backfill: Promise<void> | undefined;
	return {
		start() {
			tombstoneSweeper.start();
			trialReminders.start();
			collectionTrash.start();
			watchDigest?.start();
			liveMockSync.start();
			backfill ??= runInPrimaryTenant(logger, () =>
				backfillExampleSearchNames(logger),
			);
		},
		async stop() {
			await Promise.all([
				tombstoneSweeper.stop(),
				trialReminders.stop(),
				collectionTrash.stop(),
				watchDigest?.stop(),
				liveMockSync.stop(),
				backfill,
			]);
		},
	};
}
