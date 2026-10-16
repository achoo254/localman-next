import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { CommentModel, type StoredComment } from "./comment-model.js";

export const notFound = () =>
	new OperationError(404, "NOT_FOUND", "Comment not found");
export const forbidden = (message: string) =>
	new OperationError(403, "FORBIDDEN", message);

/** A comment of this collection; 404 otherwise (or a malformed id). */
export async function loadComment(
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
