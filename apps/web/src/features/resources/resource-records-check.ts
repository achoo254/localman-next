import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared/constants";
import { type JsonRecord, isRecord } from "../../lib/json-guards";
import { invalidJsonMessage, parseJsonText } from "../../lib/json-text";

/** Why a parsed value cannot replace the data, or null when it can. */
export function recordsProblem(value: unknown): string | null {
	if (!Array.isArray(value)) return "Dữ liệu phải là một mảng JSON.";
	if (value.length > MAX_RECORDS_PER_RESOURCE) {
		return `Tối đa ${MAX_RECORDS_PER_RESOURCE} bản ghi (đang có ${value.length}).`;
	}
	return value.every(isRecord) ? null : "Mỗi phần tử phải là một object JSON.";
}

/** The records to send, or why the text cannot replace the data. */
export function checkRecords(
	text: string,
): { records: JsonRecord[]; error: null } | { records: null; error: string } {
	const parsed = parseJsonText(text);
	if (!parsed.ok) return { records: null, error: invalidJsonMessage() };
	const error = recordsProblem(parsed.value);
	if (error !== null || !Array.isArray(parsed.value)) {
		return { records: null, error: error ?? invalidJsonMessage() };
	}
	return { records: parsed.value.filter(isRecord), error: null };
}
