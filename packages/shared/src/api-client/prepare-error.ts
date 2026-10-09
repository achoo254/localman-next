/**
 * Why a request cannot be prepared. Codes only: the web app turns them
 * into translated text, and no message carries a (possibly secret) value.
 */
export const PREPARE_ERROR_CODES = [
	"INVALID_URL",
	"INVALID_HEADER_NAME",
	"INVALID_HEADER_VALUE",
	"FILE_MISSING",
	"BODY_TOO_LARGE",
] as const;
export type PrepareErrorCode = (typeof PREPARE_ERROR_CODES)[number];

export class RequestPrepareError extends Error {
	readonly code: PrepareErrorCode;
	/** Header name or file name at fault; never a value. */
	readonly subject: string | null;

	constructor(code: PrepareErrorCode, subject: string | null = null) {
		super(subject ? `${code}: ${subject}` : code);
		this.name = "RequestPrepareError";
		this.code = code;
		this.subject = subject;
	}
}
