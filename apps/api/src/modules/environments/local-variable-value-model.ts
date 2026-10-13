import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * One person's local value of a variable, by name, in one scope
 * (`environment:<id>`, `collection:<id>` or `global:<workspaceId>`). Only
 * its owner reads or writes it; it never syncs to anyone else. One
 * document per value, so a script's writes and an edit in the table
 * cannot overwrite each other. `value` is sealed when the variable is a
 * secret (`secret-cipher.ts`, slot `localSlot`).
 */
const localVariableValueSchema = new Schema(
	{
		userId: { type: String, required: true },
		scope: { type: String, required: true },
		key: { type: String, required: true },
		value: { type: String, required: true },
		sealed: { type: Boolean, default: false },
	},
	{ collection: "local_variable_values", timestamps: true, versionKey: false },
);
localVariableValueSchema.index(
	{ userId: 1, scope: 1, key: 1 },
	{ unique: true },
);
// Deleting a scope removes everyone's values in it.
localVariableValueSchema.index({ scope: 1 });

localVariableValueSchema.plugin(tenantScopePlugin);
export const LocalVariableValueModel = mongoose.model(
	"LocalVariableValue",
	localVariableValueSchema,
);

export interface StoredLocalValue {
	readonly key: string;
	readonly value: string;
	readonly sealed?: boolean;
}
