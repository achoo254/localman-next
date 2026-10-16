import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { commentAnchorSchema } from "./comment-anchor.js";
import {
	COMMENTS_PATH,
	COMMENT_PATH,
	bodySchema,
	commentInput,
	idSchema,
} from "./comment-inputs.js";
import { reactionOperations } from "./comment-reaction-operations.js";
import { rightsOf } from "./comment-rights.js";
import {
	createComment,
	deleteComment,
	editComment,
	setResolved,
} from "./comment-service.js";
import { nodeObjectId } from "./comment-targets.js";
import { countOpenThreads, listThreads } from "./comment-view.js";
import {
	countsView,
	createdView,
	threadListView,
} from "./comment-views-schema.js";

const WHERE =
	"`nodeId` is a folder, request or example of the collection; omit it for the collection itself.";
const MENTIONS =
	"`@username` in the body tells that person (in the app, by Web Push or Telegram, as they chose) when they can open the collection.";

export const listCommentsOperation = defineOperation({
	id: "collab.listComments",
	method: "GET",
	path: COMMENTS_PATH,
	summary: "List the comment threads on a collection or one of its items",
	description: `Threads oldest first, each with its comments oldest first, reactions and whether the caller may edit, delete or resolve. Inline threads carry their anchor (part of the request, offsets, quoted text) and \`outdated\` when that place no longer holds the quoted text. Resolved threads only with \`includeResolved\`. ${WHERE} ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		nodeId: idSchema.optional(),
		includeResolved: z.boolean().default(false),
	}),
	output: threadListView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "view");
		const nodeId =
			input.nodeId === undefined ? null : nodeObjectId(input.nodeId);
		const threads = await listThreads(
			access.collectionId,
			nodeId,
			await rightsOf(sub, access),
			input.includeResolved,
		);
		return { threads };
	},
});

export const countCommentsOperation = defineOperation({
	id: "collab.countComments",
	method: "GET",
	path: `${COLLECTION_PATH}/comment-counts`,
	summary: "Count the unresolved comment threads of a collection, per item",
	description: `\`counts\` maps \`collection\` (the collection itself) and node ids to their unresolved threads; items without any are absent. ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: countsView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "view");
		return { counts: await countOpenThreads(access.collectionId) };
	},
});

export const createCommentOperation = defineOperation({
	id: "collab.createComment",
	method: "POST",
	path: COMMENTS_PATH,
	summary: "Comment on a collection or one of its items, or reply to a thread",
	description: `Markdown body. A new thread, or a reply with \`threadId\` (a reply takes its thread's item and has no anchor). An inline comment adds \`anchor\`: \`part\` (url, params, headers, body, preScript, postScript; folders and the collection only have the scripts), for params and headers the row \`rowId\` and its \`key\` or \`value\` cell, character offsets \`start\`/\`end\` and the selected \`quote\`, which must be at that place now (400 ANCHOR_MISMATCH otherwise). ${MENTIONS} A reply also tells everyone who wrote in the thread. Any role, Viewers too. 409 COMMENT_LIMIT when the collection holds 5000 comments. ${WHERE} ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		nodeId: idSchema.optional(),
		threadId: idSchema.optional(),
		body: bodySchema,
		anchor: commentAnchorSchema.optional(),
	}),
	output: createdView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "collab",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "comment");
		const created = await createComment(access, sub, input);
		return {
			id: created._id.toHexString(),
			threadId: created.threadId.toHexString(),
			nodeId: created.nodeId?.toHexString() ?? null,
		};
	},
});

export const editCommentOperation = defineOperation({
	id: "collab.editComment",
	method: "PATCH",
	path: COMMENT_PATH,
	summary: "Edit one of your comments",
	description: `Only its author (403 otherwise, even for Admins). People newly @mentioned are told. 404 NOT_FOUND for a comment not in this collection. ${ACCESS_NOTE}`,
	input: commentInput.extend({ body: bodySchema }),
	output: z.object({ id: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "comment");
		await editComment(access, sub, input.commentId, input.body);
		return { id: input.commentId };
	},
});

export const deleteCommentOperation = defineOperation({
	id: "collab.deleteComment",
	method: "DELETE",
	path: COMMENT_PATH,
	summary: "Delete a comment (the first one deletes its whole thread)",
	description: `Its author, or an Admin of the collection's workspace (who cannot edit it). Deleting a thread's first comment deletes the thread with its replies. \`dryRun\` checks the right and says whether the thread would go. ${ACCESS_NOTE}`,
	input: commentInput,
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		thread: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "collab",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "view");
		const rights = await rightsOf(sub, access);
		const { thread } = await deleteComment(
			access,
			rights,
			input.commentId,
			ctx.dryRun,
		);
		return { dryRun: ctx.dryRun, deleted: !ctx.dryRun, thread };
	},
});

export const resolveCommentThreadOperation = defineOperation({
	id: "collab.resolveCommentThread",
	method: "PUT",
	path: `${COMMENT_PATH}/resolution`,
	summary: "Resolve or reopen a comment thread",
	description: `\`commentId\` is the thread (its first comment). Its author or an Editor of the collection. Resolved threads leave list_comments unless \`includeResolved\`. ${ACCESS_NOTE}`,
	input: commentInput.extend({ resolved: z.boolean() }),
	output: z.object({ threadId: z.string(), resolved: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "comment");
		const rights = await rightsOf(sub, access);
		await setResolved(access, rights, input.commentId, input.resolved);
		return { threadId: input.commentId, resolved: input.resolved };
	},
});

export const commentOperations = [
	listCommentsOperation,
	countCommentsOperation,
	createCommentOperation,
	editCommentOperation,
	deleteCommentOperation,
	resolveCommentThreadOperation,
	...reactionOperations,
];
