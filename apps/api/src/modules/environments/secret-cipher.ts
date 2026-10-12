import { OperationError } from "@localman/operations";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { TokenCipher, TokenCipherError } from "../auth/token-cipher.js";

/**
 * Secret variable values at rest: AES-256-GCM with the keyring of
 * `VARIABLE_ENCRYPTION_KEY` (first key encrypts, the others still
 * decrypt, so a key rotates without losing values). The slot is the
 * associated data: a sealed value copied into another variable, scope or
 * person fails to open.
 */

export function secretStorageUnavailable(): OperationError {
	return new OperationError(
		503,
		"SECRET_STORAGE_UNAVAILABLE",
		"Secret values cannot be saved on this server",
	);
}

function cipher(): TokenCipher | null {
	const keyring = runtimeSettings().variableKeyring;
	return keyring ? new TokenCipher(keyring) : null;
}

/** 503 `SECRET_STORAGE_UNAVAILABLE` when the server has no keyring. */
export function sealSecret(plaintext: string, slot: string): string {
	const active = cipher();
	if (!active) throw secretStorageUnavailable();
	return active.encrypt(plaintext, slot);
}

/**
 * The plaintext, or `null` when it cannot be opened (no keyring, a key
 * since removed, or a value moved from another slot).
 */
export function openSecret(sealed: string, slot: string): string | null {
	const active = cipher();
	if (!active) return null;
	try {
		return active.decrypt(sealed, slot);
	} catch (error) {
		if (error instanceof TokenCipherError) return null;
		throw error;
	}
}

/** Slot of a shared value: the scope and the variable's stable id. */
export const sharedSlot = (scope: string, variableId: string): string =>
	`shared:${scope}:${variableId}`;

/** Slot of a person's local value of a variable, by name. */
export const localSlot = (userId: string, scope: string, key: string): string =>
	`local:${userId}:${scope}:${key}`;
