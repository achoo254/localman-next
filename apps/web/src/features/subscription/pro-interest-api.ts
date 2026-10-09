import type { ProInterestSubmission } from "@localman/shared";
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

const SUBMIT_MESSAGES: Readonly<Record<string, string>> = {
	VALIDATION_ERROR: "Thông tin chưa hợp lệ, kiểm tra lại các ô rồi gửi lại.",
	TURNSTILE_FAILED: "Xác minh không thành công, làm lại bước xác minh.",
	TURNSTILE_UNAVAILABLE:
		"Chưa kiểm tra được bước xác minh lúc này, thử lại sau ít phút.",
	RATE_LIMITED: "Bạn gửi quá nhiều lần, đợi một lát rồi thử lại.",
};

/** Vietnamese explanation of a failed submission. */
export function submitErrorMessage(error: unknown): string {
	if (error instanceof ApiError && Object.hasOwn(SUBMIT_MESSAGES, error.code)) {
		return SUBMIT_MESSAGES[error.code] ?? errorMessage(error);
	}
	return errorMessage(error);
}
