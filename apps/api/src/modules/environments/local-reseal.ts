import type { AnyBulkWriteOperation } from "mongoose";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	LocalVariableValueModel,
	type StoredLocalValue,
} from "./local-variable-value-model.js";
import {
	localSlot,
	openSecret,
	sealSecret,
	secretStorageUnavailable,
} from "./secret-cipher.js";

interface LocalRow extends StoredLocalValue {
	readonly _id: unknown;
	readonly userId: string;
}

/**
 * 503 `SECRET_STORAGE_UNAVAILABLE` when local values of `keys` exist in
 * the scope but the server cannot seal them (no keyring): checked before
 * a variable turns secret, so nothing is left half done.
 */
export async function assertCanSeal(
	scope: string,
	keys: readonly string[],
): Promise<void> {
	if (keys.length === 0 || runtimeSettings().variableKeyring) return;
	const exists = await LocalVariableValueModel.exists({
		scope,
		key: { $in: [...keys] },
	});
	if (exists) throw secretStorageUnavailable();
}

/**
 * Makes everyone's local values of `keys` sealed exactly when their
 * variable is a secret now (`secretKeys`). Run after every write on
 * either side (a variable changing type, a local value saved), so two
 * writes racing each other still end consistent. A value that cannot be
 * opened (its key is missing) is left as it is, never dropped.
 */
export async function alignLocalSealing(
	scope: string,
	keys: readonly string[],
	secretKeys: ReadonlySet<string>,
): Promise<void> {
	if (keys.length === 0) return;
	const rows = await LocalVariableValueModel.find(
		{ scope, key: { $in: [...keys] } },
		{ userId: 1, key: 1, value: 1, sealed: 1 },
	).lean<LocalRow[]>();
	const writes = rows.flatMap((row): AnyBulkWriteOperation[] => {
		const seal = secretKeys.has(row.key);
		if (seal === Boolean(row.sealed)) return [];
		const slot = localSlot(row.userId, scope, row.key);
		const plain = row.sealed ? openSecret(row.value, slot) : row.value;
		if (plain === null) return [];
		const value = seal ? sealSecret(plain, slot) : plain;
		return [
			{
				updateOne: {
					filter: { _id: row._id },
					// No longer a secret: it leaves the vault and agents lose the copy.
					update: seal
						? { $set: { value, sealed: seal } }
						: {
								$set: { value, sealed: seal, vault: false },
								$unset: { agentValue: "" as const },
							},
				},
			},
		];
	});
	if (writes.length > 0) await LocalVariableValueModel.bulkWrite(writes);
}

/** Names whose type changed between two sets of secret names. */
export function typeChanges(
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
): { changed: string[]; newlySecret: string[] } {
	const newlySecret = [...after].filter((key) => !before.has(key));
	const changed = [
		...newlySecret,
		...[...before].filter((key) => !after.has(key)),
	];
	return { changed, newlySecret };
}
