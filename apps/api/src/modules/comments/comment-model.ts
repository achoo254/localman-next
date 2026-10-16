import type {
	CommentAnchor,
	CommentReaction,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * One comment on a collection (`nodeId` null) or on one of its folders,
 * requests or examples. The first comment of a thread has `threadId` equal
 * to its own `_id` and carries the thread's anchor and resolution; replies
 * point at it. Reactions are kept per key as the people who gave them, so
 * a toggle is one `$addToSet` or `$pull`.
 */
const commentSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		nodeId: { type: Schema.Types.ObjectId, default: null },
		threadId: { type: Schema.Types.ObjectId, required: true },
		authorId: { type: String, required: true },
		body: { type: String, required: true },
		/** People @mentioned and told, so an edit does not tell them again. */
		mentions: { type: [String], default: [] },
		anchor: { type: Schema.Types.Mixed, default: null },
		reactions: { type: Schema.Types.Mixed, default: {} },
		editedAt: { type: Date, default: null },
		resolvedAt: { type: Date, default: null },
		resolvedBy: { type: String, default: null },
	},
	{ collection: "collection_comments", timestamps: true, versionKey: false },
);

commentSchema.index({ collectionId: 1, nodeId: 1, threadId: 1, _id: 1 });
commentSchema.index({ threadId: 1, _id: 1 });

commentSchema.plugin(tenantScopePlugin);
export const CommentModel = mongoose.model("CollectionComment", commentSchema);

export type StoredReactions = Partial<Record<CommentReaction, string[]>>;

export interface StoredComment {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly nodeId: Types.ObjectId | null;
	readonly threadId: Types.ObjectId;
	readonly authorId: string;
	readonly body: string;
	readonly mentions: readonly string[];
	readonly anchor: CommentAnchor | null;
	readonly reactions: StoredReactions;
	readonly editedAt: Date | null;
	readonly resolvedAt: Date | null;
	readonly resolvedBy: string | null;
	readonly createdAt: Date;
}

/** Whether the comment opened its thread. */
export const opensThread = (comment: StoredComment): boolean =>
	comment._id.equals(comment.threadId);
