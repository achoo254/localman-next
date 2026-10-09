import type { AlertTone } from "../../components/ui/alert";
import { ApiError, apiRequest } from "../../lib/api-client";

/** Public: works for visitors who are not signed in. */
export async function submitFeedback(
	body: Record<string, string>,
): Promise<void> {
	await apiRequest("/api/v1/feedback/contact", {
		method: "POST",
		body,
		redirectOnUnauthorized: false,
	});
}

/** Key under `feedback.submit` of a failed submission's explanation. */
export type SubmitProblemKey =
	| "rateLimited"
	| "validation"
	| "turnstileFailed"
	| "turnstileUnavailable"
	| "failed"
	| "sessionLost";

export interface SubmitProblem {
	tone: AlertTone;
	key: SubmitProblemKey;
}

const KNOWN: Readonly<Record<string, SubmitProblem>> = {
	RATE_LIMITED: { tone: "warning", key: "rateLimited" },
	VALIDATION_ERROR: { tone: "danger", key: "validation" },
	TURNSTILE_FAILED: { tone: "danger", key: "turnstileFailed" },
	TURNSTILE_UNAVAILABLE: { tone: "danger", key: "turnstileUnavailable" },
};

const FALLBACK: SubmitProblem = { tone: "danger", key: "failed" };

/** Explanation of a failed submission (network and 5xx included). */
export function submitProblem(error: unknown): SubmitProblem {
	if (error instanceof ApiError && Object.hasOwn(KNOWN, error.code)) {
		return KNOWN[error.code] ?? FALLBACK;
	}
	return FALLBACK;
}

/** Shown when the API treated a signed-in sender as a visitor. */
export const SESSION_LOST: SubmitProblem = {
	tone: "warning",
	key: "sessionLost",
};

/** The API asked for Turnstile: it saw no session. */
export function isTurnstileRefusal(error: unknown): boolean {
	return error instanceof ApiError && error.code === "TURNSTILE_FAILED";
}

/** `details` of a 400 `VALIDATION_ERROR`, else undefined. */
export function validationDetails(error: unknown): unknown {
	return error instanceof ApiError && error.code === "VALIDATION_ERROR"
		? error.details
		: undefined;
}
