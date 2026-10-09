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

export interface SubmitProblem {
	tone: AlertTone;
	text: string;
}

const KNOWN: Readonly<Record<string, SubmitProblem>> = {
	RATE_LIMITED: {
		tone: "warning",
		text: "Bạn gửi nhiều lần liên tiếp. Đợi vài phút rồi thử lại. Nội dung vẫn còn đây.",
	},
	VALIDATION_ERROR: {
		tone: "danger",
		text: "Thông tin chưa hợp lệ, kiểm tra lại các ô rồi gửi lại. Nội dung vẫn còn đây.",
	},
	TURNSTILE_FAILED: {
		tone: "danger",
		text: "Xác minh không thành công, làm lại bước xác minh. Nội dung vẫn còn đây.",
	},
	TURNSTILE_UNAVAILABLE: {
		tone: "danger",
		text: "Chưa kiểm tra được bước xác minh lúc này, thử lại sau ít phút. Nội dung vẫn còn đây.",
	},
};

const FALLBACK: SubmitProblem = {
	tone: "danger",
	text: "Chưa gửi được. Nội dung vẫn còn đây, hãy thử lại.",
};

/** Vietnamese explanation of a failed submission (network and 5xx included). */
export function submitProblem(error: unknown): SubmitProblem {
	if (error instanceof ApiError && Object.hasOwn(KNOWN, error.code)) {
		return KNOWN[error.code] ?? FALLBACK;
	}
	return FALLBACK;
}

/** Shown when the API treated a signed-in sender as a visitor. */
export const SESSION_LOST: SubmitProblem = {
	tone: "warning",
	text: "Phiên đăng nhập đã hết hạn. Hoàn tất bước xác minh rồi gửi lại. Nội dung vẫn còn đây.",
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
