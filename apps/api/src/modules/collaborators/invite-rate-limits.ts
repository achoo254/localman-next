import { OperationError } from "@localman/operations";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	clientIpBucket,
	takeRateLimitSlot,
} from "../../lib/rate-limit-windows.js";

/**
 * Counts one preview or accept per account and per client IP: tokens have
 * 256 bits, and the limit also keeps anyone from hammering the lookups.
 */
export async function takeInviteTokenSlot(
	sub: string,
	clientIp: string | null,
): Promise<void> {
	const limits = runtimeSettings().inviteTokenRateLimit;
	const userOk = await takeRateLimitSlot(
		"invite-token:user",
		sub,
		limits.perUser,
	);
	const ipOk = await takeRateLimitSlot(
		"invite-token:ip",
		clientIpBucket(clientIp),
		limits.perIp,
	);
	if (!userOk || !ipOk) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many invite links opened; try again later",
		);
	}
}

/**
 * Counts one account lookup of `ownerSub`. Invitations and the dialog's
 * lookups share one budget, so neither can enumerate accounts.
 */
export async function takeInviteLookupSlot(ownerSub: string): Promise<void> {
	const window = runtimeSettings().inviteRateLimit;
	if (!(await takeRateLimitSlot("invite-lookup", ownerSub, window))) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many invitations or lookups; try again later",
		);
	}
}
