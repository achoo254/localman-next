import { OperationError } from "@localman/operations";
import {
	LOCAL_VALUES_MAX,
	type LocalValue,
	type LocalValuesPatch,
} from "@localman/shared/api-client";
import type { ClientSession } from "mongoose";
import {
	LocalVariableValueModel,
	type StoredLocalValue,
} from "./local-variable-value-model.js";
import { localSlot, openSecret, sealSecret } from "./secret-cipher.js";

/**
 * A person's local values in one scope, oldest first. A sealed value that
 * cannot be opened any more (its key was removed) is left out.
 */
export async function readLocalValues(
	userId: string,
	scope: string,
): Promise<LocalValue[]> {
	const rows = await LocalVariableValueModel.find(
		{ userId, scope },
		{ key: 1, value: 1, sealed: 1 },
	)
		.sort({ createdAt: 1, _id: 1 })
		.limit(LOCAL_VALUES_MAX)
		.lean<StoredLocalValue[]>();
	return rows.flatMap((row): LocalValue[] => {
		const value = row.sealed
			? openSecret(row.value, localSlot(userId, scope, row.key))
			: row.value;
		return value === null ? [] : [{ key: row.key, value }];
	});
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
 * Sets and removes (`value: null`) the caller's local values by name;
 * names not listed keep theirs. Values of `secretKeys` are sealed. 409
 * `LOCAL_VALUES_LIMIT` when the scope would hold more than the cap.
 */
export async function patchLocalValues(
	userId: string,
	scope: string,
	patch: LocalValuesPatch,
	secretKeys: ReadonlySet<string>,
): Promise<LocalValue[]> {
	const last = new Map(patch.map((entry) => [entry.key, entry.value]));
	const removed = [...last].flatMap(([key, value]) =>
		value === null ? [key] : [],
	);
	const set = [...last].flatMap(([key, value]) =>
		value === null ? [] : [{ key, value }],
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
	const writes = set.map(({ key, value }) => {
		const sealed = secretKeys.has(key);
		const stored = sealed
			? sealSecret(value, localSlot(userId, scope, key))
			: value;
		return {
			updateOne: {
				filter: { userId, scope, key },
				update: { $set: { value: stored, sealed } },
				upsert: true,
			},
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
}
