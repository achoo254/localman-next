import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * The public docs link of a mock project: at most one per project, made
 * when an Editor publishes the docs. `slug` is 24 random bytes
 * (base64url) and the only thing the link carries. Unpublishing deletes
 * the document, so publishing again gives a new slug.
 */
const docsLinkSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		slug: { type: String, required: true },
		createdBy: { type: String, required: true },
	},
	{ collection: "project_docs_links", timestamps: true, versionKey: false },
);
docsLinkSchema.index({ slug: 1 }, { unique: true });
docsLinkSchema.index({ projectId: 1 }, { unique: true });

docsLinkSchema.plugin(tenantScopePlugin);
export const DocsLinkModel = mongoose.model("ProjectDocsLink", docsLinkSchema);

export interface StoredDocsLink {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly slug: string;
	readonly createdBy: string;
	readonly createdAt: Date;
}

export const DOCS_SLUG_BYTES = 24;
