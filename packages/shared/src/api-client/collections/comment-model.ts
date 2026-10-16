/**
 * Comments and watch of the collections API: threads on a collection,
 * folder, request or example, inline anchors, reactions, and whether the
 * caller watches a collection. Plain types: the API validates its output
 * with its own zod views.
 */

/** Characters of one comment (Markdown source). */
export const COMMENT_BODY_MAX = 10_000;
/** Comments (threads and replies together) one collection keeps. */
export const COMMENTS_PER_COLLECTION_MAX = 5_000;
/** Characters of the text an inline comment is anchored to. */
export const COMMENT_QUOTE_MAX = 1_000;
/** People one comment can @mention (more are ignored). */
export const COMMENT_MENTIONS_MAX = 20;

/** The reactions offered, by key; the web draws the emoji. */
export const COMMENT_REACTIONS = [
	"thumbsUp",
	"tada",
	"heart",
	"eyes",
	"rocket",
] as const;
export type CommentReaction = (typeof COMMENT_REACTIONS)[number];

/**
 * The part of a request (or of a folder's or the collection's scripts) an
 * inline comment points at. `params` and `headers` name a row by its id
 * and the `key` or `value` cell of it; the others are one text.
 */
export const COMMENT_ANCHOR_PARTS = [
	"url",
	"params",
	"headers",
	"body",
	"preScript",
	"postScript",
] as const;
export type CommentAnchorPart = (typeof COMMENT_ANCHOR_PARTS)[number];

/** The parts with rows (a row id and a cell). */
export const COMMENT_ROW_PARTS: readonly CommentAnchorPart[] = [
	"params",
	"headers",
];
/** The only parts of a folder or of the collection itself. */
export const COMMENT_SCRIPT_PARTS: readonly CommentAnchorPart[] = [
	"preScript",
	"postScript",
];

export interface CommentAnchor {
	part: CommentAnchorPart;
	/** The params or headers row, for those parts. */
	rowId?: string;
	/** Which cell of the row. */
	field?: "key" | "value";
	/** Character offsets of the selection in that text. */
	start: number;
	end: number;
	/** The selected text when the comment was written. */
	quote: string;
}

export interface CommentReactionView {
	key: CommentReaction;
	count: number;
	/** The caller is one of them. */
	mine: boolean;
}

export interface CommentView {
	id: string;
	authorId: string;
	/** Name (else username); `null` for a removed account. */
	authorName: string | null;
	body: string;
	createdAt: string;
	/** Set when the author edited it. */
	editedAt: string | null;
	/** Only the reactions someone gave, in `COMMENT_REACTIONS` order. */
	reactions: CommentReactionView[];
	/** The caller wrote it. */
	canEdit: boolean;
	/** The caller wrote it or is an Admin of the workspace. */
	canDelete: boolean;
}

export interface CommentThreadView {
	/** The id of its first comment. */
	id: string;
	/** `null` for the collection itself. */
	nodeId: string | null;
	anchor: (CommentAnchor & { outdated: boolean }) | null;
	resolvedAt: string | null;
	resolvedBy: string | null;
	/** The caller may resolve or reopen it (its author or an Editor). */
	canResolve: boolean;
	/** Oldest first; the first one opened the thread. */
	comments: CommentView[];
}

export interface CommentThreadList {
	threads: CommentThreadView[];
}

/** Unresolved threads per element: `collection` and node ids. */
export interface CommentCounts {
	counts: Record<string, number>;
}

export interface CollectionWatchView {
	collectionId: string;
	watching: boolean;
	/** `false` in a personal workspace: nobody else changes it. */
	available: boolean;
}
