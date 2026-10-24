import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A person's browser vault: what another device needs to derive the key
 * from the passphrase and prove it (`check`). The key and the passphrase
 * never reach the server. One per person.
 */
const secretVaultSchema = new Schema(
	{
		userId: { type: String, required: true },
		salt: { type: String, required: true },
		iterations: { type: Number, required: true },
		check: { type: String, required: true },
	},
	{ collection: "secret_vaults", timestamps: true, versionKey: false },
);
secretVaultSchema.index({ userId: 1 }, { unique: true });

secretVaultSchema.plugin(tenantScopePlugin);
export const SecretVaultModel = mongoose.model(
	"SecretVault",
	secretVaultSchema,
);

export interface StoredSecretVault {
	readonly salt: string;
	readonly iterations: number;
	readonly check: string;
}
