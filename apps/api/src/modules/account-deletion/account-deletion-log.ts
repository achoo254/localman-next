import { type Logger, createLogger } from "../../logger.js";

let deletionLogger: Logger = createLogger("silent");

/** Installed by `main.ts` with the app logger; silent until then. */
export function configureAccountDeletionLogger(logger: Logger): void {
	deletionLogger = logger;
}

/** Structured log of account deletions (counts, never content). */
export function accountDeletionLog(): Logger {
	return deletionLogger;
}
