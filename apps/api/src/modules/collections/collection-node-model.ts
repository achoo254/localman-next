import type {
	ApiRequestDraft,
	RequestAuth,
	RequestScripts,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * A folder or request of a collection, one record each, so a drag and
 * drop rewrites one record: `parentId` (`null` at the top) and `order`, a
 * fractional index key compared as a string within the parent. Folders
 * hold `auth` and `scripts`; requests hold `draft` (validated by the
 * shared schemas when written). Nodes follow their collection into the
 * trash and out of it; they have no trash state of their own.
 */
const collectionNodeSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		parentId: { type: Schema.Types.ObjectId, default: null },
		kind: { type: String, enum: ["folder", "request"], required: true },
		order: { type: String, required: true },
		name: { type: String, required: true },
		/** `name` folded for search (`foldSearchText`), kept with it. */
		searchName: { type: String },
		description: { type: String, default: "" },
		auth: { type: Schema.Types.Mixed },
		scripts: { type: Schema.Types.Mixed },
		draft: { type: Schema.Types.Mixed },
		updatedBy: { type: String, required: true },
	},
	{
		collection: "collection_nodes",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
collectionNodeSchema.index({ collectionId: 1, parentId: 1, order: 1 });
// Search scans the folded names in the index, not the documents.
collectionNodeSchema.index({ collectionId: 1, searchName: 1 });

export const CollectionNodeModel = mongoose.model(
	"CollectionNode",
	collectionNodeSchema,
);

interface StoredNodeBase {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly parentId: Types.ObjectId | null;
	readonly order: string;
	readonly name: string;
	readonly description: string;
	readonly updatedBy: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface StoredFolderNode extends StoredNodeBase {
	readonly kind: "folder";
	readonly auth: RequestAuth;
	readonly scripts: RequestScripts;
}

export interface StoredRequestNode extends StoredNodeBase {
	readonly kind: "request";
	readonly draft: ApiRequestDraft;
}

export type StoredCollectionNode = StoredFolderNode | StoredRequestNode;
