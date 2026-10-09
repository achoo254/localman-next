import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import { type JsonRecord, isRecord } from "../../lib/json-guards";
import { invalidJsonMessage, parseJsonText } from "../../lib/json-text";

/** Why a parsed value cannot replace the data, or null when it can. */
export function recordsProblem(value: unknown, t: Translate): string | null {
	if (!Array.isArray(value)) return t("resources.data.notArray");
	if (value.length > MAX_RECORDS_PER_RESOURCE) {
		return t("resources.data.tooMany", {
			max: MAX_RECORDS_PER_RESOURCE,
			count: value.length,
		});
	}
	return value.every(isRecord) ? null : t("resources.data.notObject");
}

/** The records to send, or why the text cannot replace the data. */
export function checkRecords(
	text: string,
	t: Translate,
): { records: JsonRecord[]; error: null } | { records: null; error: string } {
	const parsed = parseJsonText(text);
	if (!parsed.ok) return { records: null, error: invalidJsonMessage() };
	const error = recordsProblem(parsed.value, t);
	if (error !== null || !Array.isArray(parsed.value)) {
		return { records: null, error: error ?? invalidJsonMessage() };
	}
	return { records: parsed.value.filter(isRecord), error: null };
}
