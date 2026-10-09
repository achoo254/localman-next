/**
 * Plain-text search in a response body: case-insensitive, literal (the
 * query is not a pattern), at most `MAX_SEARCH_MATCHES` hits so a one-letter
 * query on a 10 MB body cannot freeze the tab.
 */

export const MAX_SEARCH_MATCHES = 1000;

export interface TextMatch {
	start: number;
	end: number;
}

/** A run of the body, `match` being the hit's index or `null`. */
export interface TextSegment {
	text: string;
	match: number | null;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Positions of `query` in `text`; an empty or blank query finds nothing. */
export function findMatches(
	text: string,
	query: string,
	max: number = MAX_SEARCH_MATCHES,
): TextMatch[] {
	if (query.trim() === "") return [];
	// A RegExp keeps indices of the original text (lower-casing may not).
	const pattern = new RegExp(escapeRegExp(query), "giu");
	const matches: TextMatch[] = [];
	for (const hit of text.matchAll(pattern)) {
		if (matches.length >= max) break;
		const start = hit.index ?? 0;
		matches.push({ start, end: start + hit[0].length });
	}
	return matches;
}

/** `text` cut at the matches, in order, for rendering with `<mark>`. */
export function splitByMatches(
	text: string,
	matches: readonly TextMatch[],
): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;
	matches.forEach((match, index) => {
		if (match.start > cursor) {
			segments.push({ text: text.slice(cursor, match.start), match: null });
		}
		segments.push({ text: text.slice(match.start, match.end), match: index });
		cursor = match.end;
	});
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), match: null });
	}
	return segments;
}
