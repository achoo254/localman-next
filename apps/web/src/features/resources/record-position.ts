import type { JsonRecord } from "../../lib/json-guards";

/** Index of the record whose `id` reads as `id` (string or number ids). */
export function recordIndexById(
	records: readonly JsonRecord[],
	id: string,
): number {
	return records.findIndex((record) => {
		const value = record.id;
		return (
			(typeof value === "string" || typeof value === "number") &&
			String(value) === id
		);
	});
}

const WHITESPACE = /\s/;

/**
 * Offset in `text` where element `index` of its top-level JSON array
 * starts, or null. Walks the text once, skipping strings (escapes
 * included) and nested values, so any formatting of valid JSON works.
 */
export function arrayElementOffset(text: string, index: number): number | null {
	if (!text.trimStart().startsWith("[")) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	let expectElement = false;
	let element = -1;
	for (let at = 0; at < text.length; at += 1) {
		const char = text.charAt(at);
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (
			depth === 1 &&
			expectElement &&
			char !== "]" &&
			!WHITESPACE.test(char)
		) {
			expectElement = false;
			element += 1;
			if (element === index) return at;
		}
		if (char === '"') inString = true;
		else if (char === "[" || char === "{") {
			depth += 1;
			if (depth === 1) expectElement = true;
		} else if (char === "]" || char === "}") depth -= 1;
		else if (char === "," && depth === 1) expectElement = true;
	}
	return null;
}
