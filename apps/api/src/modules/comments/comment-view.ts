import {
	COMMENT_REACTIONS,
	type CommentReactionView,
	type CommentThreadView,
	type CommentView,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { displayNames } from "../users/display-names.js";
import { anchorOutdated } from "./comment-anchor.js";
import {
	CommentModel,
	type StoredComment,
	type StoredReactions,
	opensThread,
} from "./comment-model.js";
import { loadTarget } from "./comment-targets.js";

/** What the caller may do beyond their own comments. */
export interface CommentRights {
	readonly sub: string;
	/** Editors resolve and reopen anyone's thread. */
	readonly resolveAny: boolean;
	/** Workspace Admins delete anyone's comment (never edit it). */
	readonly deleteAny: boolean;
}

function reactionViews(
	reactions: StoredReactions,
	sub: string,
): CommentReactionView[] {
	return COMMENT_REACTIONS.flatMap((key) => {
		const people = reactions[key] ?? [];
		return people.length === 0
			? []
			: [{ key, count: people.length, mine: people.includes(sub) }];
	});
}

function commentView(
	comment: StoredComment,
	names: ReadonlyMap<string, string>,
	rights: CommentRights,
): CommentView {
	const own = comment.authorId === rights.sub;
	return {
		id: comment._id.toHexString(),
		authorId: comment.authorId,
		authorName: names.get(comment.authorId) ?? null,
		body: comment.body,
		createdAt: comment.createdAt.toISOString(),
		editedAt: comment.editedAt?.toISOString() ?? null,
		reactions: reactionViews(comment.reactions ?? {}, rights.sub),
		canEdit: own,
		canDelete: own || rights.deleteAny,
	};
}

/**
 * The threads on the collection (`nodeId` null) or one of its items,
 * oldest first, each with its comments oldest first. Resolved threads
 * only when asked; anchors say whether they are outdated now.
 */
export async function listThreads(
	collectionId: Types.ObjectId,
	nodeId: Types.ObjectId | null,
	rights: CommentRights,
	includeResolved: boolean,
): Promise<CommentThreadView[]> {
	const { target } = await loadTarget(collectionId, nodeId);
	const comments = await CommentModel.find({ collectionId, nodeId })
		.sort({ _id: 1 })
		.lean<StoredComment[]>();
	const firsts = comments.filter(
		(comment) =>
			opensThread(comment) && (includeResolved || !comment.resolvedAt),
	);
	const names = await displayNames(comments.map((item) => item.authorId));
	return firsts.map((first) => {
		const thread = comments.filter((item) => item.threadId.equals(first._id));
		return {
			id: first._id.toHexString(),
			nodeId: first.nodeId?.toHexString() ?? null,
			anchor: first.anchor
				? { ...first.anchor, outdated: anchorOutdated(target, first.anchor) }
				: null,
			resolvedAt: first.resolvedAt?.toISOString() ?? null,
			resolvedBy: first.resolvedBy,
			canResolve: rights.resolveAny || first.authorId === rights.sub,
			comments: thread.map((item) => commentView(item, names, rights)),
		};
	});
}

/** Unresolved threads per element of the collection (`collection` for itself). */
export async function countOpenThreads(
	collectionId: Types.ObjectId,
): Promise<Record<string, number>> {
	const rows = await CommentModel.aggregate<{
		_id: Types.ObjectId | null;
		count: number;
	}>([
		{
			$match: {
				collectionId,
				resolvedAt: null,
				$expr: { $eq: ["$_id", "$threadId"] },
			},
		},
		{ $group: { _id: "$nodeId", count: { $sum: 1 } } },
	]);
	return Object.fromEntries(
		rows.map((row) => [row._id?.toHexString() ?? "collection", row.count]),
	);
}
