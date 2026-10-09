/**
 * Splits pretty-printed JSON into coloured runs for the Pretty view. Text
 * runs are rendered by React (never as HTML), so a body cannot inject
 * markup through a string value.
 */

export type JsonTokenKind = "key" | "string" | "number" | "literal" | "plain";

export interface JsonToken {
	kind: JsonTokenKind;
	text: string;
}

const TOKEN =
	/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export function highlightJson(json: string): JsonToken[] {
	const tokens: JsonToken[] = [];
	let cursor = 0;
	const plain = (end: number): void => {
		if (end > cursor) {
			tokens.push({ kind: "plain", text: json.slice(cursor, end) });
		}
	};
	for (const match of json.matchAll(TOKEN)) {
		const start = match.index ?? 0;
		plain(start);
		const [whole, quoted, colon, literal] = match;
		if (quoted !== undefined) {
			tokens.push({ kind: colon ? "key" : "string", text: quoted });
			if (colon) tokens.push({ kind: "plain", text: colon });
		} else {
			tokens.push({ kind: literal ? "literal" : "number", text: whole });
		}
		cursor = start + whole.length;
	}
	plain(json.length);
	return tokens;
}
