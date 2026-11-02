/**
 * Single source of truth for every account quota. There are no plans:
 * every account gets the same limits (owner decision 2026-11-02, see
 * docs/decisions/0011-one-level-for-everyone.md). Other modules must read
 * limits from `LIMITS` instead of hardcoding numbers.
 *
 * Semantics:
 * - `null` on a monthly counter means "no monthly cap"; only the per-second
 *   rate limit applies. The counters still record usage.
 * - `Infinity` means the resource has no count cap. `JSON.stringify` turns
 *   `Infinity` into `null`, so serialise limits through an explicit mapping
 *   before sending them to clients.
 */

/**
 * Size caps of mock data (Jev 0.60): a record holds at most 32 KB and a
 * resource's records together at most 2 MB of compact JSON. They stop a
 * template or a pasted array from turning a resource into a data store or
 * a memory bomb.
 */
export const MAX_RECORD_BYTES = 32 * 1024;
export const MAX_RESOURCE_BYTES = 2 * 1024 * 1024;

export interface AccountLimits {
	readonly projects: number;
	/** Every resource of every project the account owns, counted together. */
	readonly resources: number;
	readonly teamWorkspaces: number;
	readonly membersPerWorkspace: number;
	readonly mockRequestsPerMonth: number | null;
	readonly proxyRequestsPerMonth: number | null;
	readonly trashDays: number;
	readonly requestLogDays: number;
	readonly webhookInboxes: number;
}

export const LIMITS: AccountLimits = Object.freeze({
	projects: 20,
	resources: 50,
	teamWorkspaces: Number.POSITIVE_INFINITY,
	membersPerWorkspace: 10,
	mockRequestsPerMonth: null,
	proxyRequestsPerMonth: null,
	trashDays: 30,
	requestLogDays: 30,
	webhookInboxes: 20,
});
