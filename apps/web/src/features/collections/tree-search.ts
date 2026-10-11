/**
 * Search of the collections sidebar: case and accent insensitive ("dang"
 * finds "Đăng"), with the matched range in the original name so the row
 * can highlight it.
 */

/** One character as search compares it: no accents, lower case. */
function foldChar(char: string): string {
	return char
		.normalize("NFD")
		.replace(/\p{M}+/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase();
}

/** The whole text folded the same way, for the query. */
export function foldText(text: string): string {
	return [...text].map(foldChar).join("");
}

/**
 * `[start, end)` of the first match of `query` in `name`, in code units
 * of `name`; `null` when it does not match or the query is blank.
 */
export function matchRange(
	name: string,
	query: string,
): [number, number] | null {
	const needle = foldText(query.trim());
	if (needle === "") return null;
	let folded = "";
	// Original offset of each folded code unit, plus one past the end.
	const offsets: number[] = [];
	let offset = 0;
	for (const char of name) {
		const piece = foldChar(char);
		for (let i = 0; i < piece.length; i += 1) offsets.push(offset);
		folded += piece;
		offset += char.length;
	}
	offsets.push(offset);
	const at = folded.indexOf(needle);
	if (at === -1) return null;
	const start = offsets[at] ?? 0;
	const lastUnit = offsets[at + needle.length - 1] ?? start;
	// End after the whole original character holding the last folded unit.
	const next = offsets.find((value) => value > lastUnit);
	return [start, next ?? name.length];
}

export function matches(name: string, query: string): boolean {
	return matchRange(name, query) !== null;
}
