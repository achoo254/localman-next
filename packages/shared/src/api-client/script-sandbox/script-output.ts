/**
 * Reads the JSON the prelude's `finish` returns. The script could have
 * tampered with built-ins inside the VM, so nothing is trusted: every field
 * is type-checked and the caps are applied again on this side.
 */
import { HTTP_METHODS, type HeaderEntry } from "../request-model.js";
import {
	MAX_SCRIPT_LOG_ENTRIES,
	MAX_SCRIPT_LOG_LENGTH,
	MAX_SCRIPT_MESSAGE_LENGTH,
	MAX_SCRIPT_SCOPE_VALUE_LENGTH,
	MAX_SCRIPT_SCOPE_VARIABLES,
	MAX_SCRIPT_TESTS,
	MAX_SCRIPT_VARIABLES,
	MAX_SCRIPT_VARIABLE_LENGTH,
	SCRIPT_LOG_LEVELS,
	type ScriptError,
	type ScriptLogEntry,
	type ScriptLogLevel,
	type ScriptRequest,
	type ScriptTestResult,
} from "./script-types.js";

export interface SandboxOutput {
	/** Pre phase only: the request as the script left it. */
	request: ScriptRequest | null;
	/** Why `lm.request` cannot be sent; reported as a script error. */
	requestProblem: string | null;
	globals: Record<string, string>;
	collectionVariables: Record<string, string>;
	environment: Record<string, string>;
	variables: Record<string, string>;
	tests: ScriptTestResult[];
	logs: ScriptLogEntry[];
	logsTruncated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLogLevel(value: unknown): value is ScriptLogLevel {
	return SCRIPT_LOG_LEVELS.some((level) => level === value);
}

function readVariables(
	value: unknown,
	max = MAX_SCRIPT_VARIABLES,
	length = MAX_SCRIPT_VARIABLE_LENGTH,
): Record<string, string> | null {
	if (!isRecord(value)) return null;
	const entries = Object.entries(value);
	if (entries.length > max) return null;
	const valid: [string, string][] = [];
	for (const [key, text] of entries) {
		if (typeof text !== "string") return null;
		if (text.length > length) return null;
		valid.push([key, text]);
	}
	// fromEntries defines own keys, so a "__proto__" variable stays data.
	return Object.fromEntries(valid);
}

function readTests(value: unknown): ScriptTestResult[] | null {
	if (!Array.isArray(value) || value.length > MAX_SCRIPT_TESTS) return null;
	const tests: ScriptTestResult[] = [];
	for (const item of value) {
		if (!isRecord(item) || typeof item.name !== "string") return null;
		if (typeof item.passed !== "boolean") return null;
		if (item.error !== null && typeof item.error !== "string") return null;
		tests.push({
			name: item.name.slice(0, MAX_SCRIPT_MESSAGE_LENGTH),
			passed: item.passed,
			error: item.error?.slice(0, MAX_SCRIPT_MESSAGE_LENGTH) ?? null,
		});
	}
	return tests;
}

function readLogs(value: unknown): ScriptLogEntry[] | null {
	if (!Array.isArray(value) || value.length > MAX_SCRIPT_LOG_ENTRIES) {
		return null;
	}
	const logs: ScriptLogEntry[] = [];
	for (const item of value) {
		if (!isRecord(item) || !isLogLevel(item.level)) return null;
		if (typeof item.message !== "string") return null;
		const message = item.message.slice(0, MAX_SCRIPT_LOG_LENGTH);
		logs.push({ level: item.level, message });
	}
	return logs;
}

function readHeaders(value: unknown): HeaderEntry[] | string {
	if (!Array.isArray(value)) return "lm.request.headers must be an array";
	const headers: HeaderEntry[] = [];
	for (const [index, item] of value.entries()) {
		if (
			!isRecord(item) ||
			typeof item.name !== "string" ||
			typeof item.value !== "string"
		) {
			return `lm.request.headers[${index}] must be { name, value } strings`;
		}
		headers.push({ name: item.name, value: item.value });
	}
	return headers;
}

/** The request a pre script left, or why it cannot be sent. */
function readRequest(value: unknown): ScriptRequest | string {
	if (!isRecord(value)) return "lm.request is missing";
	const method =
		typeof value.method === "string" ? value.method.toUpperCase() : "";
	const knownMethod = HTTP_METHODS.find((known) => known === method);
	if (!knownMethod) {
		return `lm.request.method must be one of ${HTTP_METHODS.join(", ")}`;
	}
	if (typeof value.url !== "string") return "lm.request.url must be a string";
	if (value.body !== null && typeof value.body !== "string") {
		return "lm.request.body must be a string or null";
	}
	const headers = readHeaders(value.headers);
	if (typeof headers === "string") return headers;
	return { method: knownMethod, url: value.url, headers, body: value.body };
}

const MALFORMED: ScriptError = {
	code: "SCRIPT_INTERNAL",
	message: "The sandbox returned a malformed result",
};

export function readSandboxOutput(
	json: string,
	phase: "pre" | "post",
): SandboxOutput | ScriptError {
	let root: unknown;
	try {
		root = JSON.parse(json);
	} catch {
		return MALFORMED;
	}
	if (!isRecord(root) || typeof root.logsTruncated !== "boolean") {
		return MALFORMED;
	}
	const scope = (value: unknown) =>
		readVariables(
			value,
			MAX_SCRIPT_SCOPE_VARIABLES,
			MAX_SCRIPT_SCOPE_VALUE_LENGTH,
		);
	const globals = scope(root.globals);
	const collectionVariables = scope(root.collectionVariables);
	const environment = scope(root.environment);
	const variables = readVariables(root.variables);
	const tests = readTests(root.tests);
	const logs = readLogs(root.logs);
	if (!globals || !collectionVariables || !environment || !variables) {
		return MALFORMED;
	}
	if (!tests || !logs) return MALFORMED;

	let request: ScriptRequest | null = null;
	let requestProblem: string | null = null;
	if (phase === "pre") {
		const read =
			typeof root.requestError === "string"
				? `lm.request: ${root.requestError}`
				: readRequest(root.request);
		if (typeof read === "string") requestProblem = read;
		else request = read;
	}
	const logsTruncated = root.logsTruncated;
	return {
		request,
		requestProblem,
		globals,
		collectionVariables,
		environment,
		variables,
		tests,
		logs,
		logsTruncated,
	};
}
