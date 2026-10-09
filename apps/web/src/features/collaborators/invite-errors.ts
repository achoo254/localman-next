import { ApiError, errorMessage } from "../../lib/api-client";

export const NOT_FOUND_MESSAGE =
	"Không tìm thấy tài khoản với username hoặc email này.";

type Messages = Readonly<Record<string, string>>;

/** Messages of the invite dialog's lookup and invitation errors. */
const DIALOG_MESSAGES: Messages = {
	INVITEE_NOT_FOUND: NOT_FOUND_MESSAGE,
	ALREADY_MEMBER: "Người này đã có trong project.",
	CANNOT_INVITE_SELF: "Người này đã có trong project.",
	VALIDATION_ERROR: "Nhập username hoặc email hợp lệ.",
	RATE_LIMITED:
		"Bạn đã tra cứu hoặc mời quá nhiều lần. Hãy thử lại sau ít phút.",
	CONFLICT: "Danh sách thành viên vừa thay đổi. Hãy thử lại.",
};

/** Messages of `/invite/:token` errors that are not a state of their own. */
const PAGE_MESSAGES: Messages = {
	RATE_LIMITED: "Bạn đã mở quá nhiều link mời. Hãy thử lại sau ít phút.",
	CONFLICT: "Lời mời vừa thay đổi. Hãy thử lại.",
};

const PAGE_FALLBACK = "Không mở được lời mời. Hãy thử lại sau.";

/**
 * Vietnamese message for `error`: the mapped code, else the client's own
 * messages (network, bad response), which are Vietnamese already. API
 * messages are English, so an unmapped API code gets `fallback`.
 */
function messageFor(error: unknown, messages: Messages, fallback: string) {
	if (!(error instanceof ApiError)) return errorMessage(error);
	const mapped = messages[error.code];
	if (mapped) return mapped;
	// Status 0 (no connection) and non-JSON answers come from the client.
	return error.status === 0 ||
		error.code.startsWith("HTTP_") ||
		error.code === "INVALID_JSON"
		? errorMessage(error)
		: fallback;
}

export function inviteErrorMessage(error: unknown): string {
	return messageFor(
		error,
		DIALOG_MESSAGES,
		"Không mời được lúc này. Hãy thử lại sau.",
	);
}

export function invitePageErrorMessage(error: unknown): string {
	return messageFor(error, PAGE_MESSAGES, PAGE_FALLBACK);
}

/** Loose shape check for the "no account yet, invite this email" path. */
export function looksLikeEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
