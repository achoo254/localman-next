import type { ProInterestSubmission } from "@localman/shared";
import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { ApiError, apiRequest, errorMessage } from "../../lib/api-client";
import { expectRecord, optionalString } from "../../lib/json-guards";

export interface ProInterestConfig {
	/** Cloudflare Turnstile site key; null when the check is turned off. */
	turnstileSiteKey: string | null;
}

/** Public: visitors who are not signed in can read it. */
export async function fetchProInterestConfig(): Promise<ProInterestConfig> {
	const data = expectRecord(
		await apiRequest("/api/v1/feedback/pro-interest/config", {
			redirectOnUnauthorized: false,
		}),
		"pro interest config",
	);
	return { turnstileSiteKey: optionalString(data, "turnstileSiteKey") };
}

export async function submitProInterest(
	submission: ProInterestSubmission,
): Promise<void> {
	await apiRequest("/api/v1/feedback/pro-interest", {
		method: "POST",
		body: submission,
		redirectOnUnauthorized: false,
	});
}

type SubmitErrorKey =
	`subscription.proInterest.submitErrors.${keyof SourceMessages["subscription"]["proInterest"]["submitErrors"]}`;

const SUBMIT_KEYS: Readonly<Record<string, SubmitErrorKey>> = {
	VALIDATION_ERROR: "subscription.proInterest.submitErrors.validation",
	TURNSTILE_FAILED: "subscription.proInterest.submitErrors.turnstileFailed",
	TURNSTILE_UNAVAILABLE:
		"subscription.proInterest.submitErrors.turnstileUnavailable",
	RATE_LIMITED: "subscription.proInterest.submitErrors.rateLimited",
};

/** Explanation of a failed submission in the current language. */
export function submitErrorMessage(error: unknown, t: Translate): string {
	const key =
		error instanceof ApiError && Object.hasOwn(SUBMIT_KEYS, error.code)
			? SUBMIT_KEYS[error.code]
			: undefined;
	return key ? t(key) : errorMessage(error);
}
