/**
 * Keys of the nodes Live Mock Sync manages, stable across syncs: a node
 * keeps its key while its resource lives, whatever the resource's name,
 * prefix or place in the tree, so comments and history stay on it.
 */

/** Author of the changes Live Mock Sync writes (never a real account). */
export const LIVE_MOCK_SYNC_AUTHOR = "system:live-mock-sync";

/** Shown wherever the author's name is (changelog, "updated by"). */
export const LIVE_MOCK_SYNC_AUTHOR_NAME = "Live Mock Sync";

/** Collection URL (`/users`) or item URL (`/users/{{userId}}`). */
export type MockScope = "collection" | "item";

/** The folder that holds requests and folders the mock no longer serves. */
export const REMOVED_KEY = "mock:_removed";

export const folderKey = (resourceId: string): string =>
	`mock:${resourceId}:folder`;

export const requestKey = (
	resourceId: string,
	method: string,
	scope: MockScope,
): string => `mock:${resourceId}:${method}:${scope}`;

export const exampleKey = (requestNodeKey: string): string =>
	`${requestNodeKey}:example`;

/** Whether a key names a node Live Mock Sync made (else a user's node id). */
export const isMockKey = (key: string): boolean => key.startsWith("mock:");
