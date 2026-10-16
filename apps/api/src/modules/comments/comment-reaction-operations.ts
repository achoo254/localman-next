import { defineOperation } from "@localman/operations";
import { COMMENT_REACTIONS } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import { ACCESS_NOTE } from "../collections/collection-read-operations.js";
import { COMMENT_PATH, commentInput } from "./comment-inputs.js";
import { setReaction } from "./comment-thread-service.js";

const REACTION_PATH = `${COMMENT_PATH}/reactions/:reaction`;
const reactionView = z.object({
	commentId: z.string(),
	reaction: z.enum(COMMENT_REACTIONS),
	on: z.boolean(),
});

function reactionOperation(on: boolean) {
	return defineOperation({
		id: on ? "collab.addCommentReaction" : "collab.removeCommentReaction",
		method: on ? "PUT" : "DELETE",
		path: REACTION_PATH,
		summary: on ? "React to a comment" : "Take back your reaction",
		description: `One of ${COMMENT_REACTIONS.join(", ")} (👍 🎉 ❤️ 👀 🚀); each person gives each reaction at most once. Any role. ${ACCESS_NOTE}`,
		input: commentInput.extend({ reaction: z.enum(COMMENT_REACTIONS) }),
		output: reactionView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "collab",
		mcp: true,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const access = await requireCollection(
				sub,
				input.collectionId,
				"comment",
			);
			await setReaction(access, sub, input.commentId, input.reaction, on);
			return { commentId: input.commentId, reaction: input.reaction, on };
		},
	});
}

export const reactionOperations = [
	reactionOperation(true),
	reactionOperation(false),
];
