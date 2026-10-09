/** Parsing of JSON typed by the user (templates, records). */

export type JsonParseResult = { ok: true; value: unknown } | { ok: false };

export function parseJsonText(text: string): JsonParseResult {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

/** Message for unparsable JSON, with the place when it is known. */
export function invalidJsonMessage(
	at: { line: number; column: number } | null = null,
): string {
	return at
		? `JSON không hợp lệ ở dòng ${at.line}, cột ${at.column}.`
		: "JSON không hợp lệ.";
}
