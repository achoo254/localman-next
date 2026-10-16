import {
	COMMENT_ANCHOR_PARTS,
	COMMENT_REACTIONS,
} from "@localman/shared/api-client";
import { z } from "zod";

/** Output schemas of the comment operations (`CommentThreadView` & co). */
const anchorView = z.object({
	part: z.enum(COMMENT_ANCHOR_PARTS),
	rowId: z.string().optional(),
	field: z.enum(["key", "value"]).optional(),
	start: z.number(),
	end: z.number(),
	quote: z.string(),
	outdated: z.boolean(),
});

const commentView = z.object({
	id: z.string(),
	authorId: z.string(),
	authorName: z.string().nullable(),
	body: z.string(),
	createdAt: z.string(),
	editedAt: z.string().nullable(),
	reactions: z.array(
		z.object({
			key: z.enum(COMMENT_REACTIONS),
			count: z.number(),
			mine: z.boolean(),
		}),
	),
	canEdit: z.boolean(),
	canDelete: z.boolean(),
});

export const threadListView = z.object({
	threads: z.array(
		z.object({
			id: z.string(),
			nodeId: z.string().nullable(),
			anchor: anchorView.nullable(),
			resolvedAt: z.string().nullable(),
			resolvedBy: z.string().nullable(),
			canResolve: z.boolean(),
			comments: z.array(commentView),
		}),
	),
});

export const countsView = z.object({
	counts: z.record(z.string(), z.number()),
});

export const createdView = z.object({
	id: z.string(),
	threadId: z.string(),
	nodeId: z.string().nullable(),
});
