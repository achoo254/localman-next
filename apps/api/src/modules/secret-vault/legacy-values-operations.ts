import { type AnyOperation, defineOperation } from "@localman/operations";
import { isVaultCiphertext } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSession } from "../../http/require-auth.js";
import { LOCAL_VALUES_BODY_LIMIT } from "../environments/environment-inputs.js";
import {
	LEGACY_BATCH,
	listLegacyValues,
	sealLegacyValues,
} from "./legacy-values-service.js";

const BROWSER_ONLY =
	"Only the person's browser holds the vault key that encrypts these values; an agent never reads them";

const PATH = "/users/me/secret-vault/legacy-values";
const scope = z.string().min(1).max(100);
const key = z.string().min(1).max(200);

export const listLegacyValuesOperation = defineOperation({
	id: "users.listLegacySecretValues",
	method: "GET",
	path: PATH,
	summary: "List your secret local values not in the vault yet",
	description: `Your own local values of secret variables (environments, globals, collection variables flagged secret) saved before the vault, as plain text, for the browser to encrypt; at most ${LEGACY_BATCH} at a time (\`more\`: list again after sealing these). Needs a browser session.`,
	input: z.object({}),
	output: z.object({
		values: z.array(
			z.object({ scope: z.string(), key: z.string(), value: z.string() }),
		),
		more: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx) => listLegacyValues(requireSession(ctx).sub),
});

export const sealLegacyValuesOperation = defineOperation({
	id: "users.sealLegacySecretValues",
	method: "POST",
	path: PATH,
	summary: "Replace secret local values by their vault ciphertext",
	description:
		"Each item replaces your local value only while it is still exactly `expected` and its variable still a secret, so an edit made meanwhile is kept (`skipped`). `value` must be an lmv1: ciphertext. 409 SECRET_VAULT_REQUIRED without a vault. Needs a browser session.",
	input: z.object({
		items: z
			.array(
				z.object({
					scope,
					key,
					expected: z.string().max(10_000),
					value: z
						.string()
						.refine(isVaultCiphertext, "must be an lmv1: ciphertext"),
				}),
			)
			.min(1)
			.max(LEGACY_BATCH),
	}),
	output: z.object({ sealed: z.number().int(), skipped: z.number().int() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "users",
	mcp: { exempt: BROWSER_ONLY },
	bodyLimit: LOCAL_VALUES_BODY_LIMIT,
	handler: async (ctx, input) =>
		sealLegacyValues(requireSession(ctx).sub, input.items),
});

export const legacyValuesOperations: readonly AnyOperation[] = [
	listLegacyValuesOperation,
	sealLegacyValuesOperation,
];
