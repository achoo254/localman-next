/** Last characters kept visible by default: enough for `name-01`, `v2.0`, ids. */
export const MIDDLE_ELLIPSIS_TAIL = 8;

export interface MiddleEllipsisParts {
	/** Start of the text; the part CSS truncates with `…` when space runs out. */
	head: string;
	/** End of the text, always shown; empty when the text is too short to split. */
	tail: string;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
	granularity: "grapheme",
});

/**
 * Splits `text` for a one-line middle ellipsis: render `head` with
 * `truncate` (it shrinks) and `tail` beside it (it does not), so two long
 * names that share a prefix still show their different endings:
 * `customer-rel…name-01`. Splits between graphemes, so a Vietnamese
 * accent, a CJK character or an emoji is never cut in half. `head + tail`
 * is always the whole text, which keeps the accessible name complete.
 */
export function middleEllipsisParts(
	text: string,
	tailLength: number = MIDDLE_ELLIPSIS_TAIL,
): MiddleEllipsisParts {
	const keep = Math.max(0, Math.floor(tailLength));
	const graphemes = Array.from(
		graphemeSegmenter.segment(text),
		(part) => part.segment,
	);
	// A text up to twice the tail is short: truncating its end loses little.
	if (keep === 0 || graphemes.length <= keep * 2) {
		return { head: text, tail: "" };
	}
	return {
		head: graphemes.slice(0, -keep).join(""),
		tail: graphemes.slice(-keep).join(""),
	};
}
