/**
 * Errors and warnings of the request importers (cURL, Collection v2.1,
 * OpenAPI). Codes and params only: the web app translates them, and no
 * message repeats a header, body or secret from the input.
 */

/** Values filled into a translated message (`{max}`, `{option}`…). */
export type RequestImportParams = Readonly<Record<string, string | number>>;

export const REQUEST_IMPORT_ERROR_CODES = [
	/** `{ max }` bytes. */
	"INPUT_TOO_LARGE",
	"EMPTY_INPUT",
	"INVALID_JSON",
	/** YAML is not read; the user should convert the document to JSON. */
	"YAML_NOT_SUPPORTED",
	"UNKNOWN_FORMAT",
	/** `{ version }`: Swagger 2, OpenAPI other than 3.x, Collection v1. */
	"UNSUPPORTED_VERSION",
	/** Not a `curl` command, or no URL in it. */
	"INVALID_CURL",
	/** A quote opened in the command is never closed. */
	"UNTERMINATED_QUOTE",
	/** `{ path }`: a required part has the wrong shape. */
	"INVALID_DOCUMENT",
	/** `{ max }`: nested deeper or holding more values than allowed. */
	"TOO_COMPLEX",
] as const;
export type RequestImportErrorCode =
	(typeof REQUEST_IMPORT_ERROR_CODES)[number];

export const REQUEST_IMPORT_WARNING_CODES = [
	/** `{ option }`: a cURL option with no equivalent, ignored. */
	"UNSUPPORTED_OPTION",
	/** `{ type }`: an auth type the client does not have; set to none. */
	"UNSUPPORTED_AUTH",
	/** `{ mode }`: a body kind the client does not have; left empty. */
	"UNSUPPORTED_BODY",
	/** `{ method }`: a method outside the supported list; GET is used. */
	"UNSUPPORTED_METHOD",
	/** `{ name }`: a file is not part of the import; pick it again. */
	"FILE_NOT_INCLUDED",
	/** A script calls `pm.*`; scripts here use `lm.*`. */
	"SCRIPT_REVIEW",
	/** `{ max }`: requests, folders or table rows past `max` were dropped. */
	"TRUNCATED",
	/** `{ count }`: the cURL command names more URLs; only the first is kept. */
	"EXTRA_URLS",
	/** `{ ref }`: a `$ref` that is external, missing or cyclic; skipped. */
	"UNRESOLVED_REF",
	/** `{ count }`: warnings past the cap, not listed. */
	"MORE_WARNINGS",
] as const;
export type RequestImportWarningCode =
	(typeof REQUEST_IMPORT_WARNING_CODES)[number];

export interface RequestImportError {
	readonly code: RequestImportErrorCode;
	readonly params: RequestImportParams;
}

export interface RequestImportWarning {
	readonly code: RequestImportWarningCode;
	/** Folder and request names, `" / "`-joined; `""` for the whole input. */
	readonly path: string;
	readonly params: RequestImportParams;
}

export type RequestImportResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: RequestImportError };

/** Thrown inside an importer, turned into `{ ok: false }` at its boundary. */
export class RequestImportFailure extends Error {
	readonly code: RequestImportErrorCode;
	readonly params: RequestImportParams;

	constructor(code: RequestImportErrorCode, params: RequestImportParams = {}) {
		super(code);
		this.name = "RequestImportFailure";
		this.code = code;
		this.params = params;
	}
}

/**
 * Runs an importer and maps what it threw onto a result. A stack overflow
 * or a bug becomes `INVALID_DOCUMENT`: never a stack, never input text.
 */
export function runImport<T>(work: () => T): RequestImportResult<T> {
	try {
		return { ok: true, value: work() };
	} catch (error) {
		if (error instanceof RequestImportFailure) {
			return { ok: false, error: { code: error.code, params: error.params } };
		}
		return { ok: false, error: { code: "INVALID_DOCUMENT", params: {} } };
	}
}

/** Names from the input used as params: cut to 200 characters. */
export const paramText = (text: string): string => text.slice(0, 200);
