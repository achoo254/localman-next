import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * One user watching one collection. `lastSeq` is the changelog revision
 * the watcher was last told about (or the one current when they started
 * watching); the digest job tells them about later revisions of others.
 */
const collectionWatchSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		userId: { type: String, required: true },
		lastSeq: { type: Number, required: true, default: 0 },
	},
	{ collection: "collection_watches", timestamps: true, versionKey: false },
);
collectionWatchSchema.index({ collectionId: 1, userId: 1 }, { unique: true });

collectionWatchSchema.plugin(tenantScopePlugin);
export const CollectionWatchModel = mongoose.model(
	"CollectionWatch",
	collectionWatchSchema,
);

export interface StoredWatch {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly userId: string;
	readonly lastSeq: number;
}
