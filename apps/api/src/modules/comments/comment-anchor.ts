import { OperationError } from "@localman/operations";
import {
	type ApiRequestDraft,
	COMMENT_ANCHOR_PARTS,
	COMMENT_QUOTE_MAX,
	COMMENT_ROW_PARTS,
	COMMENT_SCRIPT_PARTS,
	type CommentAnchor,
	type RequestScripts,
} from "@localman/shared/api-client";
import { z } from "zod";

/** Offsets stay within what a request may hold. */
const offset = z.number().int().min(0).max(10_000_000);

export const commentAnchorSchema = z
	.object({
		part: z.enum(COMMENT_ANCHOR_PARTS),
		rowId: z.string().min(1).max(64).optional(),
		field: z.enum(["key", "value"]).optional(),
		start: offset,
		end: offset,
		quote: z.string().min(1).max(COMMENT_QUOTE_MAX),
	})
	.refine((anchor) => anchor.end > anchor.start, {
		message: "end must be after start",
	})
	.refine(
		(anchor) =>
			COMMENT_ROW_PARTS.includes(anchor.part) ===
			(anchor.rowId !== undefined && anchor.field !== undefined),
		{ message: "rowId and field go with params and headers, only" },
	);

/**
 * What a comment is written on: the collection's own scripts, a folder's
 * scripts, a request's draft, or an example (no inline anchors).
 */
export type CommentTarget =
	| { readonly kind: "collection" | "folder"; readonly scripts: RequestScripts }
	| { readonly kind: "request"; readonly draft: ApiRequestDraft }
	| { readonly kind: "example" };

function scriptOf(scripts: RequestScripts, part: string): string | null {
	if (part === "preScript") return scripts.pre;
	if (part === "postScript") return scripts.post;
	return null;
}

function rowCell(
	rows: readonly { id: string; key: string; value: string }[],
	anchor: CommentAnchor,
): string | null {
	const row = rows.find((item) => item.id === anchor.rowId);
	if (!row || anchor.field === undefined) return null;
	return row[anchor.field];
}

/** The whole text the anchor points into, `null` when it is gone. */
export function anchorText(
	target: CommentTarget,
	anchor: CommentAnchor,
): string | null {
	if (target.kind === "example") return null;
	if (target.kind !== "request") {
		return COMMENT_SCRIPT_PARTS.includes(anchor.part)
			? scriptOf(target.scripts, anchor.part)
			: null;
	}
	const draft = target.draft;
	switch (anchor.part) {
		case "url":
			return draft.url;
		case "params":
			return rowCell(draft.params, anchor);
		case "headers":
			return rowCell(draft.headers, anchor);
		case "body":
			return draft.body.raw;
		default:
			return scriptOf(draft.scripts, anchor.part);
	}
}

/**
 * Outdated once the anchored place no longer holds the quoted text: the
 * row is gone, or the characters at those offsets changed.
 */
export function anchorOutdated(
	target: CommentTarget,
	anchor: CommentAnchor,
): boolean {
	const text = anchorText(target, anchor);
	return text === null || text.slice(anchor.start, anchor.end) !== anchor.quote;
}

/** 400 `ANCHOR_MISMATCH` unless the anchor matches the element now. */
export function requireAnchorMatches(
	target: CommentTarget,
	anchor: CommentAnchor,
): void {
	if (anchorOutdated(target, anchor)) {
		throw new OperationError(
			400,
			"ANCHOR_MISMATCH",
			"The selected text is not at that place of the element; reload it and select again",
		);
	}
}
