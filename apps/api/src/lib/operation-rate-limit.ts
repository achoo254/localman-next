import { OperationError } from "@localman/operations";
import {
	type HeavyOperation,
	runtimeSettings,
} from "../config/runtime-settings.js";
import { takeRateLimitSlot } from "./rate-limit-windows.js";

function rateLimited(): OperationError {
	return new OperationError(
		429,
		"RATE_LIMITED",
		"Too many of these operations; wait a minute and try again",
	);
}

/**
 * Counts one run of a heavy dashboard operation for the account and then
 * for the project, and throws 429 `RATE_LIMITED` past either window of
 * `heavyOperationRateLimit`. An account over its own window stops before
 * the project count, so it cannot spend the project's budget and lock
 * out the other members. Call it after the access check, so someone
 * without access cannot spend a project's budget either. `projectId` is
 * `null` for an operation outside any project: only the account counts.
 */
export async function takeOperationSlot(
	operation: HeavyOperation,
	sub: string,
	projectId: string | null,
): Promise<void> {
	const limits = runtimeSettings().heavyOperationRateLimit[operation];
	const userOk = await takeRateLimitSlot(
		`operation:${operation}:user`,
		sub,
		limits.perUser,
	);
	if (!userOk) throw rateLimited();
	if (projectId === null || limits.perProject === undefined) return;
	const projectOk = await takeRateLimitSlot(
		`operation:${operation}:project`,
		projectId,
		limits.perProject,
	);
	if (!projectOk) throw rateLimited();
}
