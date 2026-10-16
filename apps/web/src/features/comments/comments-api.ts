/** Comments of a collection, parsed. */
import {
	COMMENT_ANCHOR_PARTS,
	COMMENT_REACTIONS,
	type CommentAnchor,
	type CommentReaction,
	type CommentReactionView,
	type CommentThreadView,
	type CommentView,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { collectionPath } from "../collections/collections-api";

const commentsPath = (collectionId: string) =>
	`${collectionPath(collectionId)}/comments`;
const commentPath = (collectionId: string, commentId: string) =>
	`${commentsPath(collectionId)}/${encodeURIComponent(commentId)}`;

function reactionOf(value: unknown): CommentReactionView {
	const data = expectRecord(value, "reaction");
	const key = COMMENT_REACTIONS.find((item) => item === data.key);
	if (!key) throw new InvalidResponseError("reaction");
	return {
		key,
		count: expectNumber(data, "count"),
		mine: expectBoolean(data, "mine"),
	};
}

function commentOf(value: unknown): CommentView {
	const data = expectRecord(value, "comment");
	return {
		id: expectString(data, "id"),
		authorId: expectString(data, "authorId"),
		authorName: optionalString(data, "authorName"),
		body: expectString(data, "body"),
		createdAt: expectString(data, "createdAt"),
		editedAt: optionalString(data, "editedAt"),
		reactions: expectArray(data, "reactions").map(reactionOf),
		canEdit: expectBoolean(data, "canEdit"),
		canDelete: expectBoolean(data, "canDelete"),
	};
}

function anchorOf(data: JsonRecord): CommentThreadView["anchor"] {
	const part = COMMENT_ANCHOR_PARTS.find((item) => item === data.part);
	if (!part) throw new InvalidResponseError("anchor");
	const field =
		data.field === "key" || data.field === "value" ? data.field : undefined;
	const rowId = typeof data.rowId === "string" ? data.rowId : undefined;
	return {
		part,
		...(rowId === undefined ? {} : { rowId }),
		...(field === undefined ? {} : { field }),
		start: expectNumber(data, "start"),
		end: expectNumber(data, "end"),
		quote: expectString(data, "quote"),
		outdated: expectBoolean(data, "outdated"),
	};
}

export function parseThread(value: unknown): CommentThreadView {
	const data = expectRecord(value, "thread");
	return {
		id: expectString(data, "id"),
		nodeId: optionalString(data, "nodeId"),
		anchor:
			data.anchor === null
				? null
				: anchorOf(expectRecord(data.anchor, "anchor")),
		resolvedAt: optionalString(data, "resolvedAt"),
		resolvedBy: optionalString(data, "resolvedBy"),
		canResolve: expectBoolean(data, "canResolve"),
		comments: expectArray(data, "comments").map(commentOf),
	};
}

/** Threads of the collection (`nodeId` null) or one of its items. */
export async function fetchThreads(
	collectionId: string,
	nodeId: string | null,
	includeResolved: boolean,
): Promise<CommentThreadView[]> {
	const query = new URLSearchParams();
	if (nodeId !== null) query.set("nodeId", nodeId);
	if (includeResolved) query.set("includeResolved", "true");
	const suffix = query.size > 0 ? `?${query.toString()}` : "";
	const data = expectRecord(
		await apiRequest(`${commentsPath(collectionId)}${suffix}`),
		"thread list",
	);
	return expectArray(data, "threads").map(parseThread);
}

/** Unresolved threads per item (`collection` for the collection itself). */
export async function fetchCommentCounts(
	collectionId: string,
): Promise<Record<string, number>> {
	const data = expectRecord(
		await apiRequest(`${collectionPath(collectionId)}/comment-counts`),
		"comment counts",
	);
	const counts = expectRecord(data.counts, "counts");
	return Object.fromEntries(
		Object.keys(counts).map((key) => [key, expectNumber(counts, key)]),
	);
}

export interface NewComment {
	nodeId: string | null;
	body: string;
	threadId?: string;
	anchor?: CommentAnchor;
}

export async function createComment(
	collectionId: string,
	comment: NewComment,
): Promise<{ id: string; threadId: string }> {
	const { nodeId, ...rest } = comment;
	const data = expectRecord(
		await apiRequest(commentsPath(collectionId), {
			method: "POST",
			body: nodeId === null ? rest : { ...rest, nodeId },
		}),
		"created comment",
	);
	return {
		id: expectString(data, "id"),
		threadId: expectString(data, "threadId"),
	};
}

export async function editComment(
	collectionId: string,
	commentId: string,
	body: string,
): Promise<void> {
	await apiRequest(commentPath(collectionId, commentId), {
		method: "PATCH",
		body: { body },
	});
}

export async function deleteComment(
	collectionId: string,
	commentId: string,
): Promise<void> {
	await apiRequest(commentPath(collectionId, commentId), {
		method: "DELETE",
	});
}

export async function setThreadResolved(
	collectionId: string,
	threadId: string,
	resolved: boolean,
): Promise<void> {
	await apiRequest(`${commentPath(collectionId, threadId)}/resolution`, {
		method: "PUT",
		body: { resolved },
	});
}

export async function setReaction(
	collectionId: string,
	commentId: string,
	reaction: CommentReaction,
	on: boolean,
): Promise<void> {
	await apiRequest(
		`${commentPath(collectionId, commentId)}/reactions/${reaction}`,
		{ method: on ? "PUT" : "DELETE" },
	);
}
