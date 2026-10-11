/**
 * Text folded for case- and accent-insensitive search: decomposed, marks
 * dropped, lower-cased. "đ" has no decomposition, so it is mapped by hand
 * (Vietnamese names are common here).
 */
export function foldSearchText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[đĐ]/g, "d")
		.toLowerCase();
}

/** `text` as a literal inside a regular expression. */
export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
