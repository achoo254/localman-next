/**
 * Moves local values of secrets saved before the vault into it (phase 21:
 * "re-encrypt when the passphrase is set"), in every environment, globals
 * and collection at once, not only those opened on screen. The server
 * lists them in plain text to this browser session only; the browser
 * seals each for its scope and name and sends the ciphertext back, which
 * the server takes only while the stored value is still the one listed,
 * so an edit made meanwhile is never overwritten.
 */
import { apiRequest } from "../../lib/api-client";
import { expectArray, expectRecord, isRecord } from "../../lib/json-guards";
import { sealValue, valueAad } from "./vault-crypto";
import { vaultKey } from "./vault-session";

const PATH = "/api/v1/users/me/secret-vault/legacy-values";
/** A safety stop: each round seals up to 200 values. */
const MAX_ROUNDS = 25;

interface LegacyValue {
	readonly scope: string;
	readonly key: string;
	readonly value: string;
}

async function fetchLegacyValues(): Promise<{
	values: LegacyValue[];
	more: boolean;
}> {
	const data = expectRecord(await apiRequest(PATH), "legacy values");
	const values = expectArray(data, "values").flatMap((item): LegacyValue[] =>
		isRecord(item) &&
		typeof item.scope === "string" &&
		typeof item.key === "string" &&
		typeof item.value === "string"
			? [{ scope: item.scope, key: item.key, value: item.value }]
			: [],
	);
	return { values, more: data.more === true };
}

async function sendSealed(
	items: readonly (LegacyValue & { expected: string })[],
): Promise<number> {
	const data = expectRecord(
		await apiRequest(PATH, { method: "POST", body: { items } }),
		"sealed legacy values",
	);
	return typeof data.sealed === "number" ? data.sealed : 0;
}

/**
 * Seals every legacy value while the vault stays open; returns how many
 * the server replaced. Stops when the vault locks meanwhile.
 */
export async function migrateLegacyValues(): Promise<number> {
	let total = 0;
	for (let round = 0; round < MAX_ROUNDS; round += 1) {
		const key = vaultKey();
		if (!key) return total;
		const { values, more } = await fetchLegacyValues();
		if (values.length === 0) return total;
		const items = await Promise.all(
			values.map(async (entry) => ({
				scope: entry.scope,
				key: entry.key,
				expected: entry.value,
				value: await sealValue(
					key,
					entry.value,
					valueAad(entry.scope, entry.key),
				),
			})),
		);
		if (vaultKey() !== key) return total;
		const sealed = await sendSealed(items);
		total += sealed;
		if (!more || sealed === 0) return total;
	}
	return total;
}
