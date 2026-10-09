import { OperationError } from "@localman/operations";
import {
	type HeavyOperation,
	runtimeSettings,
} from "../config/runtime-settings.js";
import { takeRateLimitSlot } from "./rate-limit-windows.js";

/**
 * Counts one run of a heavy dashboard operation for the account and for
 * the project, and throws 429 `RATE_LIMITED` past either window of
 * `heavyOperationRateLimit`. Call it after the access check, so someone
 * without access cannot spend a project's budget.
 */
export async function takeOperationSlot(
	operation: HeavyOperation,
	sub: string,
	projectId: string,
): Promise<void> {
	const limits = runtimeSettings().heavyOperationRateLimit[operation];
	const userOk = await takeRateLimitSlot(
		`operation:${operation}:user`,
		sub,
		limits.perUser,
	);
	const projectOk = await takeRateLimitSlot(
		`operation:${operation}:project`,
		projectId,
		limits.perProject,
	);
	if (!userOk || !projectOk) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many of these operations; wait a minute and try again",
		);
	}
}
