import { OperationError } from "@localman/operations";
import {
	LOCAL_VALUES_MAX,
	type LocalValue,
	type LocalValuesPatch,
	isVaultCiphertext,
} from "@localman/shared/api-client";
import type { ClientSession } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import { AgentSecretUseModel } from "../secret-vault/agent-secret-use-model.js";
import { secretVaultEnabled } from "../secret-vault/secret-vault-gate.js";
import { alignLocalSealing } from "./local-reseal.js";
import {
	LocalVariableValueModel,
	type StoredLocalValue,
} from "./local-variable-value-model.js";
import {
	BROWSER_WRITER,
	type LocalWriter,
	assertVaultRules,
} from "./local-vault-rules.js";
import {
	agentSlot,
	localSlot,
	openSecret,
	sealSecret,
} from "./secret-cipher.js";

/**
 * A person's local values in one scope, oldest first. A sealed value that
 * cannot be opened any more (its key was removed) is left out. `agentUse`
 * says the person let agents use it; the copy itself never leaves here.
 */
export async function readLocalValues(
	userId: string,
	scope: string,
): Promise<LocalValue[]> {
	const rows = await LocalVariableValueModel.find(
		{ userId, scope },
		{ key: 1, value: 1, sealed: 1, agentValue: 1 },
	)
		.sort({ createdAt: 1, _id: 1 })
		.limit(LOCAL_VALUES_MAX)
		.lean<StoredLocalValue[]>();
	return rows.flatMap((row): LocalValue[] => {
		const value = row.sealed
			? openSecret(row.value, localSlot(userId, scope, row.key))
			: row.value;
		if (value === null) return [];
		return row.agentValue
			? [{ key: row.key, value, agentUse: true }]
			: [{ key: row.key, value }];
	});
}

/**
 * The copies agents may use of a person's vault values in one scope, by
 * name (ADR-0009). A copy that cannot be opened is left out.
 */
export async function readAgentCopies(
	userId: string,
	scope: string,
): Promise<Map<string, string>> {
	const rows = await LocalVariableValueModel.find(
		{ userId, scope, agentValue: { $exists: true } },
		{ key: 1, agentValue: 1 },
	).lean<StoredLocalValue[]>();
	const copies = new Map<string, string>();
	for (const row of rows) {
		if (!row.agentValue) continue;
		const plain = openSecret(row.agentValue, agentSlot(userId, scope, row.key));
		if (plain !== null) copies.set(row.key, plain);
	}
	return copies;
}

function limitReached(count: number): OperationError {
	return new OperationError(
		409,
		"LOCAL_VALUES_LIMIT",
		`At most ${LOCAL_VALUES_MAX} local values per environment, collection or globals`,
		{ max: LOCAL_VALUES_MAX, count },
	);
}

/**
 * What a scope is right now: still there, which names are sealed secrets,
 * and which belong in the browser vault (`vaultKeys`, default
 * `secretKeys`; collection secrets are vault names but not sealed).
 */
export interface ScopeState {
	readonly exists: boolean;
	readonly secretKeys: ReadonlySet<string>;
	readonly vaultKeys?: ReadonlySet<string>;
}

/**
 * Sets and removes (`value: null`) the caller's local values by name;
 * names not listed keep theirs. Values of secret names are sealed. The
 * scope is read again after writing: sealing is aligned with a variable
 * changed meanwhile, and values written into a scope deleted meanwhile
 * are removed (404). 409 `LOCAL_VALUES_LIMIT` past the cap. The vault's
 * rules apply first (`assertVaultRules`).
 */
export async function patchLocalValues(
	userId: string,
	scope: string,
	patch: LocalValuesPatch,
	stateOf: () => Promise<ScopeState>,
	writer: LocalWriter = BROWSER_WRITER,
): Promise<LocalValue[]> {
	const { exists, secretKeys, vaultKeys = secretKeys } = await stateOf();
	if (!exists) throw elementNotFound();
	await assertVaultRules(userId, patch, vaultKeys, writer);
	const vaultOn = secretVaultEnabled();
	const last = new Map(patch.map((entry) => [entry.key, entry]));
	const removed = [...last.values()].flatMap((entry) =>
		entry.value === null ? [entry.key] : [],
	);
	const set = [...last.values()].flatMap((entry) =>
		entry.value === null
			? []
			: [{ key: entry.key, value: entry.value, agentValue: entry.agentValue }],
	);
	if (set.length > 0) {
		const existing = await LocalVariableValueModel.find(
			{ userId, scope },
			{ key: 1 },
		).lean<{ key: string }[]>();
		const keys = new Set(existing.map((row) => row.key));
		for (const key of removed) keys.delete(key);
		for (const entry of set) keys.add(entry.key);
		if (keys.size > LOCAL_VALUES_MAX) throw limitReached(keys.size);
	}
	const writes = set.map(({ key, value, agentValue }) => {
		const sealed = secretKeys.has(key);
		const stored = sealed
			? sealSecret(value, localSlot(userId, scope, key))
			: value;
		// In the vault: a secret's ciphertext while the vault runs (a reset drops it).
		const vault = vaultOn && vaultKeys.has(key) && isVaultCiphertext(value);
		const fields = { value: stored, sealed, vault };
		// A new value without its copy stops the old copy: never stale.
		const update =
			typeof agentValue === "string"
				? {
						$set: {
							...fields,
							agentValue: sealSecret(agentValue, agentSlot(userId, scope, key)),
						},
					}
				: { $set: fields, $unset: { agentValue: "" as const } };
		return {
			updateOne: { filter: { userId, scope, key }, update, upsert: true },
		};
	});
	if (removed.length > 0) {
		await LocalVariableValueModel.deleteMany({
			userId,
			scope,
			key: { $in: removed },
		});
	}
	if (writes.length > 0) await LocalVariableValueModel.bulkWrite(writes);
	const after = await stateOf();
	if (!after.exists) {
		await deleteScopeLocalValues([scope]);
		throw elementNotFound();
	}
	await alignLocalSealing(
		scope,
		set.map((entry) => entry.key),
		after.secretKeys,
	);
	return readLocalValues(userId, scope);
}

/** Everyone's local values in these scopes (the scope is being deleted). */
export async function deleteScopeLocalValues(
	scopes: readonly string[],
	session?: ClientSession,
): Promise<void> {
	if (scopes.length === 0) return;
	await LocalVariableValueModel.deleteMany(
		{ scope: { $in: scopes } },
		{ session },
	);
	// And what people let their agents use there.
	await AgentSecretUseModel.deleteMany({ scope: { $in: scopes } }, { session });
}
