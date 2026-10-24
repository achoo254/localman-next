import { OperationError } from "@localman/operations";
import {
	type LocalValuesPatch,
	VARIABLE_VALUE_MAX,
	isVaultCiphertext,
} from "@localman/shared/api-client";
import { secretVaultEnabled } from "../secret-vault/secret-vault-gate.js";
import { hasSecretVault } from "../secret-vault/secret-vault-service.js";

/** Who writes local values: the owner's browser, or an agent (MCP token). */
export interface LocalWriter {
	readonly agent: boolean;
}

export const BROWSER_WRITER: LocalWriter = { agent: false };

function keysOf(patch: LocalValuesPatch): string[] {
	return [...new Set(patch.map((entry) => entry.key))];
}

/**
 * The browser vault's rules on a local values patch (ADR-0009), while
 * `SECRET_VAULT_ENABLED` is on. `vaultKeys`: names whose local value
 * belongs in the vault (secret variables of the scope).
 *
 * - An agent never writes such a value, nor a copy for agents (403
 *   `SECRET_VAULT_AGENT_WRITE`): the value lives in the user's browser.
 * - The browser writes it only as an `lmv1:` ciphertext, and only once
 *   the user has a vault (409 `SECRET_VAULT_REQUIRED`, `details.keys`).
 * - `agentValue` goes with the vault ciphertext of a vault name (400
 *   `SECRET_VAULT_AGENT_COPY_INVALID`).
 *
 * Off, only `agentValue` is refused (404 `SECRET_VAULT_DISABLED`).
 */
export async function assertVaultRules(
	userId: string,
	patch: LocalValuesPatch,
	vaultKeys: ReadonlySet<string>,
	writer: LocalWriter,
): Promise<void> {
	const copies = patch.filter((entry) => entry.agentValue !== undefined);
	const vaultOn = secretVaultEnabled();
	// Only a vault ciphertext of a vault name may pass the plain value limit.
	const tooLong = patch.filter(
		(entry) =>
			entry.value !== null &&
			entry.value.length > VARIABLE_VALUE_MAX &&
			!(vaultOn && vaultKeys.has(entry.key) && isVaultCiphertext(entry.value)),
	);
	if (tooLong.length > 0) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`A local value is at most ${VARIABLE_VALUE_MAX} characters`,
			{ keys: keysOf(tooLong).join(", ") },
		);
	}
	if (!vaultOn) {
		if (copies.length > 0) {
			throw new OperationError(
				404,
				"SECRET_VAULT_DISABLED",
				"The secret vault is not available on this server",
			);
		}
		return;
	}
	const vaultWrites = patch.filter(
		(entry) => entry.value !== null && vaultKeys.has(entry.key),
	);
	if (writer.agent) {
		const refused = keysOf([...vaultWrites, ...copies]);
		if (refused.length > 0) {
			throw new OperationError(
				403,
				"SECRET_VAULT_AGENT_WRITE",
				"Local values of secret variables live in the user's browser vault; only the user sets them",
				{ keys: refused.join(", ") },
			);
		}
		return;
	}
	const invalid = copies.filter(
		(entry) =>
			typeof entry.agentValue === "string" &&
			(!vaultKeys.has(entry.key) ||
				entry.value === null ||
				!isVaultCiphertext(entry.value)),
	);
	if (invalid.length > 0) {
		throw new OperationError(
			400,
			"SECRET_VAULT_AGENT_COPY_INVALID",
			"A copy for agents goes with the vault ciphertext of a secret variable",
			{ keys: keysOf(invalid).join(", ") },
		);
	}
	if (vaultWrites.length === 0) return;
	const plain = vaultWrites.filter(
		(entry) => entry.value === null || !isVaultCiphertext(entry.value),
	);
	if (plain.length > 0 || !(await hasSecretVault(userId))) {
		throw new OperationError(
			409,
			"SECRET_VAULT_REQUIRED",
			"Local values of secret variables are saved encrypted by your vault; unlock or create it first",
			{ keys: keysOf(plain.length > 0 ? plain : vaultWrites).join(", ") },
		);
	}
}
