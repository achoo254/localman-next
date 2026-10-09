/**
 * Contract of the pre-request and post-response script sandbox. Scripts see
 * a `lm` object (no `pm` alias); everything crosses the sandbox boundary as
 * JSON, so these shapes are all the caller and the script share.
 */
import { MAX_ROW_VALUE_LENGTH } from "../limits.js";
import type { HeaderEntry, HttpMethod } from "../request-model.js";
import type { ClientResponse } from "../response-model.js";

/** Lines `console.*` may record per run; later calls are dropped. */
export const MAX_SCRIPT_LOG_ENTRIES = 200;
/** Characters kept of one console line. */
export const MAX_SCRIPT_LOG_LENGTH = 4 * 1024;
/** `lm.test` calls per run. */
export const MAX_SCRIPT_TESTS = 200;
/** Keys `lm.environment` and `lm.variables` may each hold after a run. */
export const MAX_SCRIPT_VARIABLES = 500;
/** A variable ends up as a table value, so it shares that cap. */
export const MAX_SCRIPT_VARIABLE_LENGTH = MAX_ROW_VALUE_LENGTH;
/** Characters kept of an error or failed-assertion message. */
export const MAX_SCRIPT_MESSAGE_LENGTH = 1024;

export const SCRIPT_LOG_LEVELS = ["log", "info", "warn", "error"] as const;
export type ScriptLogLevel = (typeof SCRIPT_LOG_LEVELS)[number];

export const SCRIPT_ERROR_CODES = [
	/** The script threw, has a syntax error, or left `lm.request` invalid. */
	"SCRIPT_ERROR",
	"SCRIPT_TOO_LONG",
	"SCRIPT_TIMEOUT",
	"SCRIPT_MEMORY_LIMIT",
	"SCRIPT_STACK_OVERFLOW",
	/** The QuickJS module could not be loaded (network, CSP, wasm). */
	"SCRIPT_UNAVAILABLE",
	/** The sandbox itself misbehaved; not caused by the script text. */
	"SCRIPT_INTERNAL",
] as const;
export type ScriptErrorCode = (typeof SCRIPT_ERROR_CODES)[number];

export interface ScriptError {
	code: ScriptErrorCode;
	/** Technical detail in English; the UI labels the error by `code`. */
	message: string;
	/** 1-based line in the script, when the engine reported one. */
	line?: number;
}

/** The request as a script sees it: as typed, before `{{var}}` is filled. */
export interface ScriptRequest {
	method: HttpMethod;
	url: string;
	/** In order, repeated names kept. */
	headers: HeaderEntry[];
	/** Raw body text; `null` when the body is not text (none, form, file). */
	body: string | null;
}

interface ScriptRunBase {
	script: string;
	request: ScriptRequest;
	/** Active environment: `lm.environment`. */
	environment: Readonly<Record<string, string>>;
	/**
	 * Values local to this send: `lm.variables`. Reads fall back to the
	 * environment; writes stay here and override it for `{{var}}`.
	 */
	variables: Readonly<Record<string, string>>;
}

/** Before sending: `lm.request` can be changed, there is no `lm.response`. */
export interface PreScriptInput extends ScriptRunBase {
	phase: "pre";
}

/** After receiving: `lm.request` and `lm.response` are read-only. */
export interface PostScriptInput extends ScriptRunBase {
	phase: "post";
	response: ClientResponse;
}

export type ScriptRunInput = PreScriptInput | PostScriptInput;

export interface ScriptTestResult {
	name: string;
	passed: boolean;
	/** Why the test failed; `null` when it passed. */
	error: string | null;
}

export interface ScriptLogEntry {
	level: ScriptLogLevel;
	message: string;
}

export interface ScriptRunResult {
	/**
	 * The request to send: changed by a pre script, otherwise the input.
	 * A failed script changes nothing: request, environment and variables
	 * come back as given, and a pre script error means "do not send".
	 */
	request: ScriptRequest;
	environment: Record<string, string>;
	variables: Record<string, string>;
	/** Tests and logs recorded before an error are kept. */
	tests: ScriptTestResult[];
	logs: ScriptLogEntry[];
	/** Some console output was dropped or cut by the caps above. */
	logsTruncated: boolean;
	error: ScriptError | null;
}
