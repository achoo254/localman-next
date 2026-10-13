import type { EnvironmentColor } from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { type StoredVariable, storedVariableSchema } from "./variable-store.js";

/**
 * An environment of a workspace: its name, color and variables with their
 * shared values (secrets sealed). People's local values live apart
 * (`local-variable-value-model.ts`). Deleting one removes it for good,
 * with those local values and the active choices pointing at it.
 */
const environmentSchema = new Schema(
	{
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		name: { type: String, required: true },
		color: { type: String, required: true },
		variables: { type: [storedVariableSchema], default: [] },
		createdBy: { type: String, required: true },
		updatedBy: { type: String, required: true },
	},
	{
		collection: "environments",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
environmentSchema.index({ workspaceId: 1, name: 1 });

environmentSchema.plugin(tenantScopePlugin);
export const EnvironmentModel = mongoose.model(
	"Environment",
	environmentSchema,
);

export interface StoredEnvironment {
	readonly _id: Types.ObjectId;
	readonly workspaceId: Types.ObjectId;
	readonly name: string;
	readonly color: EnvironmentColor;
	readonly variables: StoredVariable[];
	readonly createdBy: string;
	readonly updatedBy: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** Scope name of an environment in sealed slots and local values. */
export const environmentScope = (id: Types.ObjectId | string): string =>
	`environment:${typeof id === "string" ? id : id.toHexString()}`;
