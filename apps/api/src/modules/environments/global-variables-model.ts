import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { type StoredVariable, storedVariableSchema } from "./variable-store.js";

/**
 * The global variables of a workspace, one document per workspace,
 * created by the first save. Removed with the workspace.
 */
const globalVariablesSchema = new Schema(
	{
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		variables: { type: [storedVariableSchema], default: [] },
		updatedBy: { type: String, required: true },
	},
	{
		collection: "global_variables",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
globalVariablesSchema.index({ workspaceId: 1 }, { unique: true });

globalVariablesSchema.plugin(tenantScopePlugin);
export const GlobalVariablesModel = mongoose.model(
	"GlobalVariables",
	globalVariablesSchema,
);

export interface StoredGlobals {
	readonly _id: Types.ObjectId;
	readonly workspaceId: Types.ObjectId;
	readonly variables: StoredVariable[];
	readonly updatedBy: string;
	readonly updatedAt: Date;
}

/** Scope name of a workspace's globals in sealed slots and local values. */
export const globalsScope = (workspaceId: Types.ObjectId | string): string =>
	`global:${typeof workspaceId === "string" ? workspaceId : workspaceId.toHexString()}`;
