import { useT } from "../../i18n/i18n-context";
import { ApiError, errorMessage } from "../../lib/api-client";

const CODES = {
	ANCHOR_MISMATCH: "anchorMismatch",
	COMMENT_LIMIT: "limit",
	WATCH_UNAVAILABLE: "watchUnavailable",
	FORBIDDEN: "forbidden",
	NOT_FOUND: "notFound",
} as const;

function isKnownCode(code: string): code is keyof typeof CODES {
	return Object.hasOwn(CODES, code);
}

/** Error codes of comments and watch in the reader's language. */
export function useCommentErrorMessage(): (error: unknown) => string {
	const t = useT();
	return (error) =>
		error instanceof ApiError && isKnownCode(error.code)
			? t(`collections.comments.errors.${CODES[error.code]}`)
			: errorMessage(error);
}
