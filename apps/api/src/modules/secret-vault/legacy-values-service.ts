import { OperationError } from "@localman/operations";
import { isVaultCiphertext } from "@localman/shared/api-client";
import type { SecretTest } from "../environments/agent-secret-mask.js";
import {
	LocalVariableValueModel,
	type StoredLocalValue,
} from "../environments/local-variable-value-model.js";
import {
	collectionSecrets,
	environmentSecrets,
	globalsSecrets,
} from "../environments/scope-secret-keys.js";
import {
	localSlot,
	openSecret,
	sealSecret,
} from "../environments/secret-cipher.js";
import { hasSecretVault } from "./secret-vault-service.js";

/** At most this many values per listing; the browser asks again after sealing. */
export const LEGACY_BATCH = 200;

/** A local value of a secret saved before the vault: plain for the browser. */
export interface LegacyValue {
	readonly scope: string;
	readonly key: string;
	readonly value: string;
}

/**
 * What the server knows of a scope (`environment:<id>`, `global:<ws>`,
 * `collection:<id>`): its secret names, and whether it seals their local
 * values itself (environments and globals do; collections do not).
 */
async function scopeSecrets(
	scope: string,
): Promise<{ isSecret: SecretTest; sealed: boolean } | null> {
	const [kind, id] = scope.split(":");
	if (!id) return null;
	if (kind === "environment") {
		return { isSecret: await environmentSecrets(id), sealed: true };
	}
	if (kind === "global") {
		return { isSecret: await globalsSecrets(id), sealed: true };
	}
	if (kind === "collection") {
		return { isSecret: await collectionSecrets(id), sealed: false };
	}
	return null;
}

interface Row extends StoredLocalValue {
	readonly scope: string;
}

function plainOf(userId: string, row: Row): string | null {
	return row.sealed
		? openSecret(row.value, localSlot(userId, row.scope, row.key))
		: row.value;
}

/**
 * The person's own local values of secret variables that are not in the
 * vault yet (saved before it, or while a variable was not a secret), so
 * the browser can encrypt them. Vault ciphertexts and empty values are
 * left out; `more` says another listing may find others.
 */
export async function listLegacyValues(
	userId: string,
): Promise<{ values: LegacyValue[]; more: boolean }> {
	const rows = await LocalVariableValueModel.find(
		{ userId, vault: { $ne: true } },
		{ scope: 1, key: 1, value: 1, sealed: 1 },
	)
		.sort({ _id: 1 })
		.lean<Row[]>();
	const scopes = new Map<string, Awaited<ReturnType<typeof scopeSecrets>>>();
	const values: LegacyValue[] = [];
	for (const row of rows) {
		if (!scopes.has(row.scope))
			scopes.set(row.scope, await scopeSecrets(row.scope));
		if (!scopes.get(row.scope)?.isSecret(row.key)) continue;
		const plain = plainOf(userId, row);
		if (plain === null || plain === "" || isVaultCiphertext(plain)) continue;
		if (values.length === LEGACY_BATCH) return { values, more: true };
		values.push({ scope: row.scope, key: row.key, value: plain });
	}
	return { values, more: false };
}

/** A legacy value encrypted by the browser, with the plain value it replaces. */
export interface SealedLegacyValue {
	readonly scope: string;
	readonly key: string;
	readonly expected: string;
	readonly value: string;
}

/**
 * Replaces legacy values by their vault ciphertext, each only while the
 * stored value is still exactly `expected` and its name still a secret:
 * an edit made meanwhile is never overwritten (`skipped`). 409
 * `SECRET_VAULT_REQUIRED` without a vault.
 */
export async function sealLegacyValues(
	userId: string,
	items: readonly SealedLegacyValue[],
): Promise<{ sealed: number; skipped: number }> {
	if (!(await hasSecretVault(userId))) {
		throw new OperationError(
			409,
			"SECRET_VAULT_REQUIRED",
			"Create the vault before moving values into it",
		);
	}
	let sealed = 0;
	for (const item of items) {
		const scope = await scopeSecrets(item.scope);
		const row = await LocalVariableValueModel.findOne(
			{ userId, scope: item.scope, key: item.key, vault: { $ne: true } },
			{ scope: 1, key: 1, value: 1, sealed: 1 },
		).lean<Row & { _id: unknown }>();
		if (!scope?.isSecret(item.key) || !row) continue;
		if (plainOf(userId, row) !== item.expected) continue;
		const stored = scope.sealed
			? sealSecret(item.value, localSlot(userId, item.scope, item.key))
			: item.value;
		// Matched on the value read, so a write landing in between wins.
		const { modifiedCount } = await LocalVariableValueModel.updateOne(
			{ _id: row._id, value: row.value },
			{
				$set: { value: stored, sealed: scope.sealed, vault: true },
				$unset: { agentValue: "" as const },
			},
		);
		sealed += modifiedCount;
	}
	return { sealed, skipped: items.length - sealed };
}
