import {
	RUN_BUTTON_VISIBILITIES,
	type RunButtonVisibility,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A "Run in Localman" button of a collection, with an optional
 * environment of the same workspace. `buttonId` (16 random bytes,
 * base64url) is what the README link carries. Deleting it, purging the
 * collection or deleting the environment removes the document. No
 * workspace is stored: each use checks the collection's current one.
 */
const runButtonSchema = new Schema(
	{
		buttonId: { type: String, required: true },
		collectionId: { type: Schema.Types.ObjectId, required: true },
		environmentId: { type: Schema.Types.ObjectId, default: null },
		visibility: { type: String, enum: RUN_BUTTON_VISIBILITIES, required: true },
		createdBy: { type: String, required: true },
	},
	{ collection: "run_buttons", timestamps: true, versionKey: false },
);
runButtonSchema.index({ buttonId: 1 }, { unique: true });
runButtonSchema.index({ collectionId: 1 });
runButtonSchema.index(
	{ environmentId: 1 },
	{ partialFilterExpression: { environmentId: { $type: "objectId" } } },
);

runButtonSchema.plugin(tenantScopePlugin);
export const RunButtonModel = mongoose.model("RunButton", runButtonSchema);

export interface StoredRunButton {
	readonly _id: Types.ObjectId;
	readonly buttonId: string;
	readonly collectionId: Types.ObjectId;
	readonly environmentId: Types.ObjectId | null;
	readonly visibility: RunButtonVisibility;
	readonly createdBy: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
