import { OperationError } from "@localman/operations";
import {
	COMMENTS_PER_COLLECTION_MAX,
	type CommentAnchor,
	type CommentReaction,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import type { CollectionAccess } from "../collections/collection-access.js";
import { requireAnchorMatches } from "./comment-anchor.js";
import {
	CommentModel,
	type StoredComment,
	opensThread,
} from "./comment-model.js";
import {
	type CommentPlace,
	notifyMentions,
	notifyReply,
} from "./comment-notify.js";
import { loadTarget, nodeObjectId } from "./comment-targets.js";
import type { CommentRights } from "./comment-view.js";

export interface NewComment {
	/** The folder, request or example; absent for the collection itself. */
	readonly nodeId?: string;
	readonly body: string;
	/** Inline comments only; a reply takes its thread's. */
	readonly anchor?: CommentAnchor;
	/** Set for a reply. */
	readonly threadId?: string;
}

const notFound = () =>
	new OperationError(404, "NOT_FOUND", "Comment not found");
const forbidden = (message: string) =>
	new OperationError(403, "FORBIDDEN", message);

/** A comment of this collection; 404 otherwise (or a malformed id). */
async function loadComment(
	collectionId: Types.ObjectId,
	commentId: string,
): Promise<StoredComment> {
	if (!Types.ObjectId.isValid(commentId)) throw notFound();
	const comment = await CommentModel.findOne({
		_id: new Types.ObjectId(commentId),
		collectionId,
	}).lean<StoredComment>();
	if (!comment) throw notFound();
	return comment;
}

function placeOf(
	access: CollectionAccess,
	comment: StoredComment,
	nodeName: string | null,
): CommentPlace {
	return {
		element: access.element,
		authorId: comment.authorId,
		nodeId: comment.nodeId?.toHexString() ?? null,
		nodeName,
		commentId: comment._id.toHexString(),
	};
}

async function startOrJoin(
	access: CollectionAccess,
	input: NewComment,
): Promise<{ nodeId: Types.ObjectId | null; thread: StoredComment | null }> {
	if (input.threadId === undefined) {
		return {
			nodeId: input.nodeId === undefined ? null : nodeObjectId(input.nodeId),
			thread: null,
		};
	}
	const thread = await loadComment(access.collectionId, input.threadId);
	if (!opensThread(thread)) throw notFound();
	if (input.anchor !== undefined) {
		throw new OperationError(400, "VALIDATION_ERROR", "A reply has no anchor");
	}
	return { nodeId: thread.nodeId, thread };
}

/**
 * Writes a comment (a new thread, or a reply when `threadId` is given),
 * then tells the people it @mentions and, for a reply, those who wrote
 * in the thread. 409 `COMMENT_LIMIT` past `COMMENTS_PER_COLLECTION_MAX`.
 */
export async function createComment(
	access: CollectionAccess,
	sub: string,
	input: NewComment,
): Promise<StoredComment> {
	const { nodeId, thread } = await startOrJoin(access, input);
	const { target, nodeName } = await loadTarget(access.collectionId, nodeId);
	if (input.anchor !== undefined) requireAnchorMatches(target, input.anchor);
	const count = await CommentModel.countDocuments({
		collectionId: access.collectionId,
	});
	if (count >= COMMENTS_PER_COLLECTION_MAX) {
		throw new OperationError(
			409,
			"COMMENT_LIMIT",
			`A collection keeps at most ${COMMENTS_PER_COLLECTION_MAX} comments; delete resolved threads first`,
		);
	}
	const _id = new Types.ObjectId();
	const created = (
		await CommentModel.create({
			_id,
			collectionId: access.collectionId,
			nodeId,
			threadId: thread?._id ?? _id,
			authorId: sub,
			body: input.body,
			anchor: input.anchor ?? null,
		})
	).toObject<StoredComment>();
	const place = placeOf(access, created, nodeName);
	const mentioned = await notifyMentions(place, input.body, []);
	await CommentModel.updateOne({ _id }, { $set: { mentions: mentioned } });
	if (thread) {
		const rows = await CommentModel.find(
			{ threadId: thread._id },
			{ authorId: 1 },
		).lean<{ authorId: string }[]>();
		await notifyReply(
			place,
			rows.map((row) => row.authorId),
			mentioned,
		);
	}
	return { ...created, mentions: mentioned };
}

/** Its author edits a comment; people newly @mentioned are told. */
export async function editComment(
	access: CollectionAccess,
	sub: string,
	commentId: string,
	body: string,
): Promise<void> {
	const comment = await loadComment(access.collectionId, commentId);
	if (comment.authorId !== sub) {
		throw forbidden("Only its author edits a comment");
	}
	const { nodeName } = await loadTarget(access.collectionId, comment.nodeId);
	const place = placeOf(access, comment, nodeName);
	const mentioned = await notifyMentions(place, body, comment.mentions);
	await CommentModel.updateOne(
		{ _id: comment._id },
		{
			$set: { body, editedAt: new Date() },
			$addToSet: { mentions: { $each: mentioned } },
		},
	);
}

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
