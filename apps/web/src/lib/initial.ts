const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The first character of a name for an avatar, as a reader sees it: a
 * whole grapheme (an accented letter, an emoji, a CJK character), in
 * upper case. `?` for no name.
 */
export function initialOf(name: string | null | undefined): string {
	const text = name?.trim() ?? "";
	for (const { segment } of graphemes.segment(text)) {
		return segment.toLocaleUpperCase();
	}
	return "?";
}
