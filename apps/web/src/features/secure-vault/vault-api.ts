/**
 * The server side of the vault (`/api/v1/users/me/secret-vault`): only the
 * parameters that let a device prove the passphrase. 404 means the server
 * does not run the vault (`SECRET_VAULT_ENABLED` off).
 */
import type { SecretVaultParams } from "@localman/shared/api-client";
import { ApiError, apiRequest } from "../../lib/api-client";
import { expectRecord, isRecord } from "../../lib/json-guards";

const PATH = "/api/v1/users/me/secret-vault";

function parseParams(value: unknown): SecretVaultParams | null {
	if (value === null) return null;
	if (
		!isRecord(value) ||
		typeof value.salt !== "string" ||
		typeof value.iterations !== "number" ||
		typeof value.check !== "string"
	) {
		throw new ApiError(500, "INVALID_RESPONSE", "Invalid vault parameters");
	}
	return { salt: value.salt, iterations: value.iterations, check: value.check };
}

/** `undefined` when the server has no vault at all. */
export async function fetchVaultParams(): Promise<
	SecretVaultParams | null | undefined
> {
	try {
		const data = expectRecord(await apiRequest(PATH), "vault");
		return parseParams(data.vault);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return undefined;
		throw error;
	}
}

export async function saveVaultParams(
	params: SecretVaultParams,
): Promise<SecretVaultParams> {
	const data = expectRecord(
		await apiRequest(PATH, { method: "PUT", body: params }),
		"vault",
	);
	const saved = parseParams(data.vault);
	if (!saved) throw new ApiError(500, "INVALID_RESPONSE", "No vault saved");
	return saved;
}

/** Forgot the passphrase: every local value the vault encrypted goes. */
export async function resetVaultOnServer(): Promise<number> {
	const data = expectRecord(
		await apiRequest(PATH, { method: "DELETE" }),
		"vault reset",
	);
	return typeof data.deletedValues === "number" ? data.deletedValues : 0;
}
