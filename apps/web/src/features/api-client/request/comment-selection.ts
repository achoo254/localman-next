import { EditorView } from "@codemirror/view";
/**
 * The text selected in a commentable part of the request editor: a field
 * inside `[data-comment-part]` (the URL, a params or headers cell) or a
 * code editor (body, scripts), as offsets into that part's text.
 */
import {
	COMMENT_ANCHOR_PARTS,
	COMMENT_QUOTE_MAX,
	COMMENT_ROW_PARTS,
	type CommentAnchor,
	type CommentAnchorPart,
} from "@localman/shared/api-client";

function partOf(zone: Element): CommentAnchorPart | null {
	const value = zone.getAttribute("data-comment-part");
	return COMMENT_ANCHOR_PARTS.find((part) => part === value) ?? null;
}

/** A params/headers cell: its row (`data-row`) and `-key`/`-value` field. */
function cellOf(
	input: HTMLInputElement,
): Pick<CommentAnchor, "rowId" | "field"> | null {
	const rowId = input.closest("[data-row]")?.getAttribute("data-row");
	const dataId = input.getAttribute("data-id") ?? "";
	const field = dataId.endsWith("-key")
		? "key"
		: dataId.endsWith("-value")
			? "value"
			: null;
	return rowId && field ? { rowId, field } : null;
}

function rangeOf(
	text: string,
	from: number,
	to: number,
): Pick<CommentAnchor, "start" | "end" | "quote"> | null {
	// Long selections keep their start; the quote is what the API stores.
	const end = Math.min(to, from + COMMENT_QUOTE_MAX);
	return end > from ? { start: from, end, quote: text.slice(from, end) } : null;
}

/** The selection at `target`, or `null` when nothing commentable is selected. */
export function selectionAt(target: EventTarget | null): CommentAnchor | null {
	if (!(target instanceof Element)) return null;
	const zone = target.closest("[data-comment-part]");
	const part = zone ? partOf(zone) : null;
	if (!part) return null;
	if (target instanceof HTMLInputElement) {
		const range = rangeOf(
			target.value,
			target.selectionStart ?? 0,
			target.selectionEnd ?? 0,
		);
		if (!range) return null;
		if (!COMMENT_ROW_PARTS.includes(part)) return { part, ...range };
		const cell = cellOf(target);
		return cell ? { part, ...cell, ...range } : null;
	}
	const editor = target.closest<HTMLElement>(".cm-editor");
	const view = editor ? EditorView.findFromDOM(editor) : null;
	if (!view || COMMENT_ROW_PARTS.includes(part)) return null;
	const { from, to } = view.state.selection.main;
	const range = rangeOf(view.state.doc.toString(), from, to);
	return range ? { part, ...range } : null;
}
