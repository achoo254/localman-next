import {
	COLLECTION_LINK_KINDS,
	type CollectionLinkKind,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A public or guest link of a collection: at most one of each kind per
 * collection. `linkId` is 32 random bytes (base64url) and the only thing
 * the link carries. Revoking deletes the document, so turning the link on
 * again gives a new id. No workspace is stored: serving reads the
 * collection's current one (`stillServable`).
 */
const collectionLinkSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		kind: { type: String, enum: COLLECTION_LINK_KINDS, required: true },
		linkId: { type: String, required: true },
		createdBy: { type: String, required: true },
	},
	{ collection: "collection_links", timestamps: true, versionKey: false },
);
collectionLinkSchema.index({ linkId: 1 }, { unique: true });
collectionLinkSchema.index({ collectionId: 1, kind: 1 }, { unique: true });

collectionLinkSchema.plugin(tenantScopePlugin);
export const CollectionLinkModel = mongoose.model(
	"CollectionLink",
	collectionLinkSchema,
);

export interface StoredCollectionLink {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly kind: CollectionLinkKind;
	readonly linkId: string;
	readonly createdBy: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
