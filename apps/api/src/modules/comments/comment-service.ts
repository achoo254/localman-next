import { OperationError } from "@localman/operations";
import {
	COMMENTS_PER_COLLECTION_MAX,
	type CommentAnchor,
	type CommentReaction,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import type { CollectionAccess } from "../collections/collection-access.js";
import { requireAnchorMatches } from "./comment-anchor.js";
import { forbidden, loadComment, notFound } from "./comment-lookup.js";
import {
	CommentModel,
	type StoredComment,
	opensThread,
} from "./comment-model.js";
import {
	type CommentPlace,
	planNotices,
	sendNotices,
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

const commentLimit = () =>
	new OperationError(
		409,
		"COMMENT_LIMIT",
		`A collection keeps at most ${COMMENTS_PER_COLLECTION_MAX} comments; delete resolved threads first`,
	);

/** Authors of the thread so far, for the reply notices. */
async function threadAuthors(thread: StoredComment | null): Promise<string[]> {
	if (!thread) return [];
	const rows = await CommentModel.find(
		{ threadId: thread._id },
		{ authorId: 1 },
	).lean<{ authorId: string }[]>();
	return rows.map((row) => row.authorId);
}

/**
 * Writes a comment (a new thread, or a reply when `threadId` is given),
 * then tells the people it @mentions and, for a reply, those who wrote
 * in the thread. Who to tell is worked out before writing, so a failed
 * lookup leaves no comment behind for a retry to duplicate. 429
 * `RATE_LIMITED` past the `comment` window; 409 `COMMENT_LIMIT` past
 * `COMMENTS_PER_COLLECTION_MAX` (a soft cap: racing writes may pass it
 * by a few).
 */
export async function createComment(
	access: CollectionAccess,
	sub: string,
	input: NewComment,
): Promise<StoredComment> {
	await takeOperationSlot("comment", sub, access.element.id);
	const { nodeId, thread } = await startOrJoin(access, input);
	const { target, nodeName } = await loadTarget(access.collectionId, nodeId);
	if (input.anchor !== undefined) requireAnchorMatches(target, input.anchor);
	const count = await CommentModel.countDocuments({
		collectionId: access.collectionId,
	});
	if (count >= COMMENTS_PER_COLLECTION_MAX) throw commentLimit();
	const notices = await planNotices(
		access.element,
		sub,
		input.body,
		[],
		await threadAuthors(thread),
	);
	const _id = new Types.ObjectId();
	const created = (
		await CommentModel.create({
			_id,
			collectionId: access.collectionId,
			nodeId,
			threadId: thread?._id ?? _id,
			authorId: sub,
			body: input.body,
			mentions: [...notices.mentioned],
			anchor: input.anchor ?? null,
		})
	).toObject<StoredComment>();
	// The thread may have been deleted meanwhile: take the reply back.
	if (thread && !(await CommentModel.exists({ _id: thread._id }))) {
		await CommentModel.deleteOne({ _id });
		throw notFound();
	}
	await sendNotices(placeOf(access, created, nodeName), notices);
	return created;
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
	await takeOperationSlot("comment", sub, access.element.id);
	const { nodeName } = await loadTarget(access.collectionId, comment.nodeId);
	const notices = await planNotices(
		access.element,
		sub,
		body,
		comment.mentions,
	);
	await CommentModel.updateOne(
		{ _id: comment._id },
		{
			$set: { body, editedAt: new Date() },
			$addToSet: { mentions: { $each: [...notices.mentioned] } },
		},
	);
	await sendNotices(placeOf(access, comment, nodeName), {
		...notices,
		replies: [],
	});
}
