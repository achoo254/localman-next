import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { configureSecretVault } from "../secret-vault-gate.js";

/** TEST ONLY. Turns `SECRET_VAULT_ENABLED` on, keeping the other settings. */
export function useSecretVaultOn(): void {
	beforeEach(() => configureSecretVault(true));
	afterEach(() => configureSecretVault(false));
}

/** TEST ONLY. A well-formed `lmv1:` ciphertext (random, it never opens). */
export const fakeCiphertext = (): string =>
	`lmv1:${randomBytes(48).toString("base64url")}`;

/** TEST ONLY. Vault parameters as a browser would send them. */
export const vaultParams = () => ({
	salt: randomBytes(16).toString("base64url"),
	iterations: 600_000,
	check: fakeCiphertext(),
});

/** TEST ONLY. Creates `sub`'s vault (expects 200). */
export async function createVaultAs(sub: string): Promise<void> {
	const res = await as(sub).send(
		"put",
		"/users/me/secret-vault",
		vaultParams(),
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}
