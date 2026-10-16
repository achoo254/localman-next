import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import { bodySchema, idSchema } from "../comments/comment-inputs.js";
import { rightsOf } from "../comments/comment-rights.js";
import { createComment } from "../comments/comment-service.js";
import { listThreads } from "../comments/comment-view.js";
import {
	createdView,
	threadListView,
} from "../comments/comment-views-schema.js";
import { requirePullRequest } from "./pull-request-read.js";
import {
	PULL_REQUEST_PATH,
	pullRequestIdSchema,
} from "./pull-request-views-schema.js";

const PR_COMMENTS_PATH = `${PULL_REQUEST_PATH}/comments`;
const ACCESS =
	"Anyone who can open its source collection, Viewers too. 404 PULL_REQUEST_NOT_FOUND when it does not exist or the caller cannot open that collection. Edit, delete, react to and resolve them with the comment tools of the source collection (`collectionId` is `sourceId`).";

export const listPullRequestCommentsOperation = defineOperation({
	id: "client.listPullRequestComments",
	method: "GET",
	path: PR_COMMENTS_PATH,
	summary: "List the comment threads of a pull request",
	description: `Threads oldest first, each with its comments; \`changeKey\` names the change of its diff a thread is about (\`null\` for the pull request as a whole). Resolved threads only with \`includeResolved\`. ${ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		includeResolved: z.boolean().default(false),
	}),
	output: threadListView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { pr, source } = await requirePullRequest(sub, input.pullRequestId);
		const threads = await listThreads(
			source.collectionId,
			null,
			await rightsOf(sub, source),
			input.includeResolved,
			pr._id,
		);
		return { threads };
	},
});

export const createPullRequestCommentOperation = defineOperation({
	id: "client.createPullRequestComment",
	method: "POST",
	path: PR_COMMENTS_PATH,
	summary: "Comment on a pull request or one of its changes, or reply",
	description: `Markdown body. A new thread, optionally about one change (\`changeKey\`, the \`key\` of a change in get_pull_request), or a reply with \`threadId\` (it takes its thread's change). \`@username\` tells that person when they can open the source collection; a reply also tells the thread's authors. 409 COMMENT_LIMIT when the source holds 5000 comments. ${ACCESS}`,
	input: z.object({
		pullRequestId: pullRequestIdSchema,
		threadId: idSchema.optional(),
		changeKey: z.string().min(1).max(200).optional(),
		body: bodySchema,
	}),
	output: createdView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { pr, source } = await requirePullRequest(sub, input.pullRequestId);
		const access = await requireCollection(sub, source.element.id, "comment");
		const created = await createComment(access, sub, {
			body: input.body,
			threadId: input.threadId,
			pullRequestId: pr._id,
			changeKey: input.changeKey,
		});
		return {
			id: created._id.toHexString(),
			threadId: created.threadId.toHexString(),
			nodeId: null,
		};
	},
});

export const pullRequestCommentOperations = [
	listPullRequestCommentsOperation,
	createPullRequestCommentOperation,
];
