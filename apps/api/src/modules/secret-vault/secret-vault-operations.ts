import { type AnyOperation, defineOperation } from "@localman/operations";
import { secretVaultParamsSchema } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSession } from "../../http/require-auth.js";
import { agentSecretUseOperations } from "./agent-secret-use-operations.js";
import { legacyValuesOperations } from "./legacy-values-operations.js";
import {
	countSecretVaultValues,
	createSecretVault,
	getSecretVault,
	resetSecretVault,
} from "./secret-vault-service.js";

/** Why none of these is an MCP tool. */
const BROWSER_ONLY =
	"The vault's passphrase and key live only in the user's browser; an agent can neither open nor create nor reset it";

const vaultOutput = z.object({ vault: secretVaultParamsSchema.nullable() });

export const getSecretVaultOperation = defineOperation({
	id: "users.getSecretVault",
	method: "GET",
	path: "/users/me/secret-vault",
	summary: "Read the parameters of the signed-in user's secret vault",
	description:
		"The salt, PBKDF2 iterations and check ciphertext the browser needs to derive the vault key from the passphrase and prove it; `vault: null` before the user creates one. The passphrase and key never reach the server.",
	input: z.object({}),
	output: vaultOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx) => ({
		vault: await getSecretVault(requireSession(ctx).sub),
	}),
});

export const createSecretVaultOperation = defineOperation({
	id: "users.createSecretVault",
	method: "PUT",
	path: "/users/me/secret-vault",
	summary: "Create the signed-in user's secret vault",
	description:
		"Saves the parameters of a new vault (salt, iterations, check ciphertext made in the browser). 409 SECRET_VAULT_EXISTS when the user already has one. Needs a browser session.",
	input: secretVaultParamsSchema,
	output: vaultOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "users",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => ({
		vault: await createSecretVault(requireSession(ctx).sub, input),
	}),
});

export const resetSecretVaultOperation = defineOperation({
	id: "users.resetSecretVault",
	method: "DELETE",
	path: "/users/me/secret-vault",
	summary: "Reset the signed-in user's secret vault",
	description:
		"For a forgotten passphrase: deletes the vault and every local value it encrypted, with the copies agents were allowed to use (`deletedValues`), so a new vault can be created. Shared values and other local values stay. With dryRun, only counts what would go. Needs a browser session.",
	input: z.object({}),
	output: z.object({ deletedValues: z.number().int(), dryRun: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "users",
	mcp: { exempt: BROWSER_ONLY },
	dryRun: true,
	handler: async (ctx) => {
		const { sub } = requireSession(ctx);
		if (ctx.dryRun) {
			return { deletedValues: await countSecretVaultValues(sub), dryRun: true };
		}
		return { ...(await resetSecretVault(sub)), dryRun: false };
	},
});

export const secretVaultOperations: readonly AnyOperation[] = [
	getSecretVaultOperation,
	createSecretVaultOperation,
	resetSecretVaultOperation,
	...agentSecretUseOperations,
	...legacyValuesOperations,
];
