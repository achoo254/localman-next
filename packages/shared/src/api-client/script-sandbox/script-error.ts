/**
 * Turns what went wrong in the sandbox into a `ScriptError`: an exception
 * dumped from QuickJS, or a JavaScript error the host engine threw while
 * QuickJS was running (its native stack can run out before QuickJS's own
 * stack check fires, which surfaces as a host `RangeError`).
 */
import { SCRIPT_MEMORY_BYTES, SCRIPT_TIMEOUT_MS } from "../limits.js";
import { SCRIPT_FILE_NAME } from "./script-prelude.js";
import { MAX_SCRIPT_MESSAGE_LENGTH, type ScriptError } from "./script-types.js";

const LINE_PATTERN = new RegExp(
	`(?:^|[\\s(])${SCRIPT_FILE_NAME.replace(".", "\\.")}:(\\d+)`,
	"m",
);
const MEMORY_MESSAGES = new Set(["out of memory", "string too long"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function cut(text: string): string {
	return text.length > MAX_SCRIPT_MESSAGE_LENGTH
		? text.slice(0, MAX_SCRIPT_MESSAGE_LENGTH)
		: text;
}

function describeThrown(value: unknown): string {
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

function lineOf(error: Record<string, unknown>): number | undefined {
	if (typeof error.stack === "string") {
		const match = LINE_PATTERN.exec(error.stack);
		if (match) return Number(match[1]);
	}
	const isOurs = error.fileName === SCRIPT_FILE_NAME;
	return isOurs && typeof error.lineNumber === "number"
		? error.lineNumber
		: undefined;
}

/** `dumped` is `vm.dump()` of the thrown value; Errors dump as plain objects. */
export function scriptErrorFromDump(
	dumped: unknown,
	timedOut: boolean,
): ScriptError {
	if (timedOut) {
		return {
			code: "SCRIPT_TIMEOUT",
			message: `The script ran longer than ${SCRIPT_TIMEOUT_MS} ms`,
		};
	}
	if (!isRecord(dumped) || typeof dumped.message !== "string") {
		return {
			code: "SCRIPT_ERROR",
			message: cut(`Uncaught ${describeThrown(dumped)}`),
		};
	}
	const name = typeof dumped.name === "string" ? dumped.name : "Error";
	const engineError = name === "InternalError" || name === "SyntaxError";
	if (name === "InternalError" && MEMORY_MESSAGES.has(dumped.message)) {
		const mib = SCRIPT_MEMORY_BYTES / (1024 * 1024);
		return {
			code: "SCRIPT_MEMORY_LIMIT",
			message: `The script used more than ${mib} MB of memory`,
		};
	}
	if (engineError && dumped.message === "stack overflow") {
		return {
			code: "SCRIPT_STACK_OVERFLOW",
			message: "The script nested calls too deeply",
		};
	}
	const line = lineOf(dumped);
	const error: ScriptError = {
		code: "SCRIPT_ERROR",
		message: cut(`${name}: ${dumped.message}`),
	};
	return line === undefined ? error : { ...error, line };
}

/** An exception thrown out of QuickJS into the host. */
export function scriptErrorFromHost(error: unknown): ScriptError {
	if (error instanceof RangeError) {
		return {
			code: "SCRIPT_STACK_OVERFLOW",
			message: "The script nested calls too deeply",
		};
	}
	const detail = error instanceof Error ? error.message : String(error);
	return { code: "SCRIPT_INTERNAL", message: cut(detail) };
}
