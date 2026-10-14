import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** Prefix of a collection access key, so a leaked key is recognizable. */
export const ACCESS_KEY_PREFIX = "lmck_";

/**
 * A read-only key to a collection's redacted JSON, for scripts and CI.
 * Only the SHA-256 of the key is stored, with its last characters for
 * display. It expires 60 days after its last use (checked when used, no
 * job); revoking deletes it. No workspace is stored: each use checks the
 * collection's current one (`stillServable`).
 */
const accessKeySchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		userId: { type: String, required: true },
		name: { type: String, required: true, trim: true, maxlength: 100 },
		keyHash: { type: String, required: true },
		last4: { type: String, required: true },
		lastUsedAt: { type: Date },
	},
	{
		collection: "collection_access_keys",
		timestamps: true,
		versionKey: false,
	},
);
accessKeySchema.index({ keyHash: 1 }, { unique: true });
accessKeySchema.index({ collectionId: 1, userId: 1 });

accessKeySchema.plugin(tenantScopePlugin);
export const CollectionAccessKeyModel = mongoose.model(
	"CollectionAccessKey",
	accessKeySchema,
);

export interface StoredAccessKey {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly userId: string;
	readonly name: string;
	readonly keyHash: string;
	readonly last4: string;
	readonly lastUsedAt?: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
