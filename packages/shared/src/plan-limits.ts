/**
 * Single source of truth for every plan quota. Other modules must read limits
 * through `limitsFor` instead of hardcoding numbers.
 *
 * Semantics:
 * - `null` on a monthly counter means "no monthly cap"; only the per-second
 *   rate limit applies.
 * - `Infinity` means the resource has no count cap. `JSON.stringify` turns
 *   `Infinity` into `null`, so serialise limits through an explicit mapping
 *   before sending them to clients.
 */
export type PlanId = "free" | "pro";

export interface PlanLimits {
	readonly projects: number;
	readonly resources: number;
	readonly customResponse: boolean;
	readonly objectTemplate: boolean;
	readonly teamWorkspaces: number;
	readonly membersPerWorkspace: number;
	readonly forkPrPublic: boolean;
	readonly mockRequestsPerMonth: number | null;
	readonly proxyRequestsPerMonth: number | null;
	readonly trashDays: number;
	readonly requestLogDays: number;
	readonly webhookInboxes: number;
}

// Free limits are intentionally more generous than mockapi.io and Postman Free.
export const FREE_LIMITS: PlanLimits = Object.freeze({
	projects: 3,
	resources: 10,
	customResponse: true,
	objectTemplate: true,
	teamWorkspaces: 1,
	membersPerWorkspace: 3,
	forkPrPublic: false,
	mockRequestsPerMonth: 10_000,
	proxyRequestsPerMonth: 5_000,
	trashDays: 30,
	requestLogDays: 7,
	webhookInboxes: 2,
});

export const PRO_LIMITS: PlanLimits = Object.freeze({
	projects: 20,
	resources: 50,
	customResponse: true,
	objectTemplate: true,
	teamWorkspaces: Number.POSITIVE_INFINITY,
	membersPerWorkspace: 10,
	forkPrPublic: true,
	mockRequestsPerMonth: null,
	proxyRequestsPerMonth: null,
	trashDays: 30,
	requestLogDays: 30,
	webhookInboxes: 20,
});

export const PLAN_LIMITS: Readonly<Record<PlanId, PlanLimits>> = Object.freeze({
	free: FREE_LIMITS,
	pro: PRO_LIMITS,
});

/**
 * Returns the frozen limits of a plan. Throws on an unknown plan id so a
 * corrupt value read from storage never silently falls back to some quota.
 */
export function limitsFor(plan: PlanId): PlanLimits {
	if (!Object.hasOwn(PLAN_LIMITS, plan)) {
		throw new Error(`Unknown plan id: ${String(plan)}`);
	}
	return PLAN_LIMITS[plan];
}
