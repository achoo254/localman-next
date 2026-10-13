import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * The environment a person uses in a workspace (the selector at the top
 * right). Removed when that environment is deleted; one that moved to
 * another workspace reads as none.
 */
const activeEnvironmentSchema = new Schema(
	{
		userId: { type: String, required: true },
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		environmentId: { type: Schema.Types.ObjectId, required: true },
	},
	{ collection: "active_environments", timestamps: true, versionKey: false },
);
activeEnvironmentSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });
activeEnvironmentSchema.index({ environmentId: 1 });

activeEnvironmentSchema.plugin(tenantScopePlugin);
export const ActiveEnvironmentModel = mongoose.model(
	"ActiveEnvironment",
	activeEnvironmentSchema,
);

export interface StoredActiveEnvironment {
	readonly userId: string;
	readonly workspaceId: Types.ObjectId;
	readonly environmentId: Types.ObjectId;
}
