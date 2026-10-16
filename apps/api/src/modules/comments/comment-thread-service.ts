import type { CommentReaction } from "@localman/shared/api-client";
import type { CollectionAccess } from "../collections/collection-access.js";
import { forbidden, loadComment, notFound } from "./comment-lookup.js";
import { CommentModel, opensThread } from "./comment-model.js";
import type { CommentRights } from "./comment-view.js";

/**
 * Deletes a comment (its author, or an Admin of the workspace); deleting
 * the first comment of a thread deletes the whole thread. A dry run only
 * checks the right.
 */
export async function deleteComment(
	access: CollectionAccess,
	rights: CommentRights,
	commentId: string,
	dryRun: boolean,
): Promise<{ thread: boolean }> {
	const comment = await loadComment(access.collectionId, commentId);
	if (comment.authorId !== rights.sub && !rights.deleteAny) {
		throw forbidden("Only its author or a workspace Admin deletes a comment");
	}
	const thread = opensThread(comment);
	if (dryRun) return { thread };
	await CommentModel.deleteMany(
		thread ? { threadId: comment._id } : { _id: comment._id },
	);
	return { thread };
}

/** Resolves or reopens a thread (its author or an Editor). */
export async function setResolved(
	access: CollectionAccess,
	rights: CommentRights,
	threadId: string,
	resolved: boolean,
): Promise<void> {
	const first = await loadComment(access.collectionId, threadId);
	if (!opensThread(first)) throw notFound();
	if (first.authorId !== rights.sub && !rights.resolveAny) {
		throw forbidden("Only the thread's author or an Editor resolves it");
	}
	await CommentModel.updateOne(
		{ _id: first._id },
		{
			$set: resolved
				? { resolvedAt: new Date(), resolvedBy: rights.sub }
				: { resolvedAt: null, resolvedBy: null },
		},
	);
}

/** Gives or takes back the caller's reaction (idempotent). */
export async function setReaction(
	access: CollectionAccess,
	sub: string,
	commentId: string,
	reaction: CommentReaction,
	on: boolean,
): Promise<void> {
	const comment = await loadComment(access.collectionId, commentId);
	const path = `reactions.${reaction}`;
	await CommentModel.updateOne(
		{ _id: comment._id },
		on ? { $addToSet: { [path]: sub } } : { $pull: { [path]: sub } },
	);
}
