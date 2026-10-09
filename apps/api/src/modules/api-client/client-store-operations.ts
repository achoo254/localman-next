import { clientSettingsOperations } from "./client-settings-operations.js";
import { draftOperations } from "./draft-operations.js";
import { historyOperations } from "./history-operations.js";

/**
 * Per-user state of the API client kept on the server: request history,
 * unsaved tabs and routing settings. Each user reads and writes only
 * their own records (no project, so no sharing and no project tombstone).
 */
export const clientStoreOperations = [
	...historyOperations,
	...draftOperations,
	...clientSettingsOperations,
] as const;
