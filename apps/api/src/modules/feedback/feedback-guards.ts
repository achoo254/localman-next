import { OperationError } from "@localman/operations";
import type { TurnstileAction } from "@localman/shared";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	clientIpBucket,
	takeRateLimitSlot,
} from "../../lib/rate-limit-windows.js";
import { verifyTurnstile } from "./turnstile-verifier.js";

/** Who sends a public form. */
export interface FeedbackCaller {
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
 * Rate limits of one public form (`form` names its counters); every
 * attempt counts, honeypot hits included. Per client IP (IPv6 grouped by
 * /64) for everyone, and per account for signed-in senders, whose stricter
 * limit cannot be dodged by changing network.
 */
export async function takeFeedbackSlot(
	form: string,
	caller: FeedbackCaller,
): Promise<void> {
	const limits = runtimeSettings().feedbackRateLimit;
	const ipAllowed = await takeRateLimitSlot(
		`${form}:ip`,
		clientIpBucket(caller.clientIp),
		limits.perIp,
	);
	if (!ipAllowed) throw rateLimited();
	if (caller.userSub === null) return;
	const userAllowed = await takeRateLimitSlot(
		`${form}:user`,
		caller.userSub,
		limits.perUser,
	);
	if (!userAllowed) throw rateLimited();
}

/**
 * Turnstile for guests when configured; the token must have been solved
 * on the form `action` names (`TURNSTILE_ACTIONS`). Signed-in users
 * already proved themselves at the IdP. Fails closed when Cloudflare
 * cannot answer.
 */
export async function assertHumanGuest(
	caller: FeedbackCaller,
	turnstileToken: string | undefined,
	action: TurnstileAction,
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
		action,
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
