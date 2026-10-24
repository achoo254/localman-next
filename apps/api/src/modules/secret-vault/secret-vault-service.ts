import { OperationError } from "@localman/operations";
import type { SecretVaultParams } from "@localman/shared/api-client";
import { LocalVariableValueModel } from "../environments/local-variable-value-model.js";
import {
	SecretVaultModel,
	type StoredSecretVault,
} from "./secret-vault-model.js";

/** The person's vault parameters; `null` before they create one. */
export async function getSecretVault(
	sub: string,
): Promise<SecretVaultParams | null> {
	const vault = await SecretVaultModel.findOne(
		{ userId: sub },
		{ salt: 1, iterations: 1, check: 1 },
	).lean<StoredSecretVault>();
	return vault
		? { salt: vault.salt, iterations: vault.iterations, check: vault.check }
		: null;
}

export async function hasSecretVault(sub: string): Promise<boolean> {
	return (await SecretVaultModel.exists({ userId: sub })) !== null;
}

function vaultExists(): OperationError {
	return new OperationError(
		409,
		"SECRET_VAULT_EXISTS",
		"You already have a vault; unlock it, or reset it if you forgot the passphrase",
	);
}

const isDuplicateKey = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	error.code === 11000;

/** Saves a new vault; 409 `SECRET_VAULT_EXISTS` when one is there. */
export async function createSecretVault(
	sub: string,
	params: SecretVaultParams,
): Promise<SecretVaultParams> {
	if (await hasSecretVault(sub)) throw vaultExists();
	try {
		await SecretVaultModel.create({ userId: sub, ...params });
	} catch (error) {
		// Two devices creating one at the same time: the second loses.
		if (isDuplicateKey(error)) throw vaultExists();
		throw error;
	}
	return params;
}

/** How many local values a reset would delete (the vault's ciphertexts). */
export async function countSecretVaultValues(sub: string): Promise<number> {
	return LocalVariableValueModel.countDocuments({ userId: sub, vault: true });
}

/**
 * Forgot the passphrase: the vault and every local value it encrypted
 * (with the copies agents used) go, so a new vault can start. Shared
 * values and local values of other variables are untouched.
 */
export async function resetSecretVault(
	sub: string,
): Promise<{ deletedValues: number }> {
	const { deletedCount } = await LocalVariableValueModel.deleteMany({
		userId: sub,
		vault: true,
	});
	await SecretVaultModel.deleteOne({ userId: sub });
	return { deletedValues: deletedCount };
}
