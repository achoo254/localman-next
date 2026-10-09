import { OperationError } from "@localman/operations";
import type { ProInterestSubmission } from "@localman/shared";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { alertOwnerThrottled } from "./owner-alert-throttle.js";
import { proInterestAlertText } from "./pro-interest-alert.js";
import { saveProInterest } from "./pro-interest-store.js";
import { clientIpBucket, takeRateLimitSlot } from "./submission-rate-limit.js";
import { verifyTurnstile } from "./turnstile-verifier.js";

/** Turnstile `action` the web widget declares for this form. */
export const PRO_INTEREST_TURNSTILE_ACTION = "pro_interest";

export interface ProInterestCaller {
	/** Signed-in subject, or `null` for a guest. */
	readonly userSub: string | null;
	readonly clientIp: string | null;
}

function rateLimited(): OperationError {
	return new OperationError(
		429,
		"RATE_LIMITED",
		"Too many submissions; try again later",
	);
}

/**
 * Rate limits; every attempt counts, honeypot hits included. Per client
 * IP (IPv6 grouped by /64) for everyone, and per account for signed-in
 * senders, whose stricter limit cannot be dodged by changing network.
 */
export async function takeProInterestSlot(
	caller: ProInterestCaller,
): Promise<void> {
	const limits = runtimeSettings().feedbackRateLimit;
	const ipAllowed = await takeRateLimitSlot(
		"pro-interest:ip",
		clientIpBucket(caller.clientIp),
		limits.perIp,
	);
	if (!ipAllowed) throw rateLimited();
	if (caller.userSub === null) return;
	const userAllowed = await takeRateLimitSlot(
		"pro-interest:user",
		caller.userSub,
		limits.perUser,
	);
	if (!userAllowed) throw rateLimited();
}

/**
 * Turnstile for guests when configured. Signed-in users already proved
 * themselves at the IdP. Fails closed when Cloudflare cannot answer.
 */
export async function assertHumanGuest(
	caller: ProInterestCaller,
	turnstileToken: string | undefined,
): Promise<void> {
	const { turnstile } = runtimeSettings();
	if (caller.userSub !== null || turnstile === null) return;
	if (!turnstileToken) {
		throw new OperationError(
			400,
			"TURNSTILE_FAILED",
			"Complete the anti-spam check",
		);
	}
	const outcome = await verifyTurnstile(
		turnstile,
		turnstileToken,
		caller.clientIp,
		PRO_INTEREST_TURNSTILE_ACTION,
	);
	if (outcome === "unavailable") {
		throw new OperationError(
			503,
			"TURNSTILE_UNAVAILABLE",
			"The anti-spam check is unavailable; try again shortly",
		);
	}
	if (outcome === "invalid") {
		throw new OperationError(
			400,
			"TURNSTILE_FAILED",
			"The anti-spam check failed; try again",
		);
	}
}

/** Stores the submission, then alerts the owner (throttled, in background). */
export async function recordProInterest(
	entry: ProInterestSubmission,
	userSub: string | null,
): Promise<void> {
	const outcome = await saveProInterest(entry, userSub);
	await alertOwnerThrottled(
		"feedback.pro_interest",
		proInterestAlertText(entry, outcome),
	);
}
