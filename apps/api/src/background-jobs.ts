import type { Logger } from "./logger.js";
import { backfillExampleSearchNames } from "./modules/collections/example-search-backfill.js";
import { CollectionTrashJob } from "./modules/collections/trash-purge-job.js";
import { TombstoneSweeper } from "./modules/projects/tombstone-sweeper.js";
import { TrialReminderJob } from "./modules/trial/trial-reminders.js";

/** The periodic jobs of the API process, started and stopped together. */
export interface BackgroundJobs {
	start(): void;
	/** Clears the timers and waits for running work (before Mongo closes). */
	stop(): Promise<void>;
}

export function createBackgroundJobs(logger: Logger): BackgroundJobs {
	// Finishes project deletions cut off by an error or a restart.
	const tombstoneSweeper = new TombstoneSweeper(logger);
	// Trial reminders (7 days, 1 day, ended), once per trial end.
	const trialReminders = new TrialReminderJob(logger);
	// Collections past their days in the trash are deleted for good.
	const collectionTrash = new CollectionTrashJob(logger);
	// Once per start: older examples get the folded name search uses.
	let backfill: Promise<number> | undefined;
	return {
		start() {
			tombstoneSweeper.start();
			trialReminders.start();
			collectionTrash.start();
			backfill ??= backfillExampleSearchNames(logger);
		},
		async stop() {
			await Promise.all([
				tombstoneSweeper.stop(),
				trialReminders.stop(),
				collectionTrash.stop(),
				backfill,
			]);
		},
	};
}
