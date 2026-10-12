import type { AnyBulkWriteOperation } from "mongoose";
import {
	LocalVariableValueModel,
	type StoredLocalValue,
} from "./local-variable-value-model.js";
import { localSlot, openSecret, sealSecret } from "./secret-cipher.js";

interface LocalRow extends StoredLocalValue {
	readonly _id: unknown;
	readonly userId: string;
}

/**
 * After a scope's variables change type, everyone's local values of the
 * names that became secret are sealed and those that stopped being secret
 * are opened, so a local value is sealed exactly when its variable is a
 * secret. A value that can no longer be opened is dropped. Every write is
 * computed first, so a missing keyring (503) changes nothing.
 */
export async function resealLocalValues(
	scope: string,
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
): Promise<void> {
	const toSeal = [...after].filter((key) => !before.has(key));
	const toOpen = [...before].filter((key) => !after.has(key));
	if (toSeal.length === 0 && toOpen.length === 0) return;
	const rows = await LocalVariableValueModel.find(
		{ scope, key: { $in: [...toSeal, ...toOpen] } },
		{ userId: 1, key: 1, value: 1, sealed: 1 },
	).lean<LocalRow[]>();
	const writes = rows.flatMap((row): AnyBulkWriteOperation[] => {
		const slot = localSlot(row.userId, scope, row.key);
		const plain = row.sealed ? openSecret(row.value, slot) : row.value;
		if (plain === null) return [{ deleteOne: { filter: { _id: row._id } } }];
		const seal = after.has(row.key);
		if (seal === Boolean(row.sealed)) return [];
		const value = seal ? sealSecret(plain, slot) : plain;
		return [
			{
				updateOne: {
					filter: { _id: row._id },
					update: { $set: { value, sealed: seal } },
				},
			},
		];
	});
	if (writes.length > 0) await LocalVariableValueModel.bulkWrite(writes);
}
