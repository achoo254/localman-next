/**
 * Messages between the page and the script worker: a job carries one
 * script run, a reply its result under the same id. Both sides check
 * what they receive, since `postMessage` data is untyped.
 */
import type {
	ScriptRunInput,
	ScriptRunResult,
} from "@localman/shared/api-client/script-sandbox";
import { isRecord } from "../lib/json-guards";

export interface ScriptJob {
	id: number;
	input: ScriptRunInput;
}

export interface ScriptReply {
	id: number;
	result: ScriptRunResult;
}

export function isScriptJob(value: unknown): value is ScriptJob {
	if (!isRecord(value) || !isRecord(value.input)) return false;
	const { input } = value;
	return (
		typeof value.id === "number" &&
		typeof input.script === "string" &&
		(input.phase === "pre" || input.phase === "post")
	);
}

export function isScriptReply(value: unknown): value is ScriptReply {
	if (!isRecord(value) || !isRecord(value.result)) return false;
	const { result } = value;
	return (
		typeof value.id === "number" &&
		Array.isArray(result.tests) &&
		Array.isArray(result.logs) &&
		isRecord(result.request)
	);
}
