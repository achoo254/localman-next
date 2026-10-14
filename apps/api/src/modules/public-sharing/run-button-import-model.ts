import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** How long a repeated import with the same key returns the first result. */
export const IMPORT_KEY_TTL_MS = 10 * 60 * 1000;

/**
 * One import through a Run button, keyed by the caller and the key their
 * page sent, so a double click or a retry creates one collection. Written
 * as a claim before the collection exists and completed after; an import
 * that failed before creating anything removes its claim. A key belongs to
 * one button and one target workspace. Expires after `IMPORT_KEY_TTL_MS`.
 */
const runButtonImportSchema = new Schema(
	{
		userId: { type: String, required: true },
		idempotencyKey: { type: String, required: true },
		buttonId: { type: String, required: true },
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		collectionId: { type: Schema.Types.ObjectId, default: null },
		environmentId: { type: Schema.Types.ObjectId, default: null },
		environmentError: {
			type: { code: String, message: String },
			default: null,
		},
		expiresAt: { type: Date, required: true },
	},
	{ collection: "run_button_imports", versionKey: false },
);
runButtonImportSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
runButtonImportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

runButtonImportSchema.plugin(tenantScopePlugin);
export const RunButtonImportModel = mongoose.model(
	"RunButtonImport",
	runButtonImportSchema,
);

export interface StoredRunButtonImport {
	readonly _id: Types.ObjectId;
	readonly buttonId: string;
	readonly workspaceId: Types.ObjectId;
	readonly collectionId: Types.ObjectId | null;
	readonly environmentId: Types.ObjectId | null;
	readonly environmentError: { code: string; message: string } | null;
}
