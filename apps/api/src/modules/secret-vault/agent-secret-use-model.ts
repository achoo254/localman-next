import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A person letting their agents use one secret (ADR-0009): the secret
 * `key` of a scope (`environment:<id>`, `collection:<id>`,
 * `global:<workspaceId>`) may be filled into requests to `hosts` only.
 * Set from the person's browser; never by an agent.
 */
const agentSecretUseSchema = new Schema(
	{
		userId: { type: String, required: true },
		scope: { type: String, required: true },
		key: { type: String, required: true },
		hosts: { type: [String], required: true },
	},
	{ collection: "agent_secret_uses", timestamps: true, versionKey: false },
);
agentSecretUseSchema.index({ userId: 1, scope: 1, key: 1 }, { unique: true });
// Deleting a scope removes everyone's uses in it.
agentSecretUseSchema.index({ scope: 1 });

agentSecretUseSchema.plugin(tenantScopePlugin);
export const AgentSecretUseModel = mongoose.model(
	"AgentSecretUse",
	agentSecretUseSchema,
);

export interface StoredAgentSecretUse {
	readonly scope: string;
	readonly key: string;
	readonly hosts: readonly string[];
}
