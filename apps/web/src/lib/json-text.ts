import { activeTranslator } from "../i18n/active-translator";

/** Parsing of JSON typed by the user (templates, records). */

export type JsonParseResult = { ok: true; value: unknown } | { ok: false };

export function parseJsonText(text: string): JsonParseResult {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

/**
 * Message for unparsable JSON, with the place when it is known, in the
 * language on screen.
 */
export function invalidJsonMessage(
	at: { line: number; column: number } | null = null,
): string {
	const { t } = activeTranslator();
	return at
		? t("common.errors.invalidJsonAt", { line: at.line, column: at.column })
		: t("common.errors.invalidJson");
}
