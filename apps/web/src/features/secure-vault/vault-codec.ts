/**
 * Local values through the vault. Caches keep values as the server sends
 * them (`lmv1:` ciphertext for a secret); code that uses them calls
 * `openLocalValues`, which returns the plaintext once decrypted, or the
 * value marked `locked` (it counts as withheld: a send using it stops).
 * Decryption runs in the background; `useVaultValues` re-renders when it
 * lands. Writes go through `sealLocalWrites`, which encrypts a secret's
 * value and asks for the vault when it is locked or missing.
 */
import {
	type LocalValue,
	type LocalValueWrite,
	isVaultCiphertext,
} from "@localman/shared/api-client";
import { useSyncExternalStore } from "react";
import { openValue, sealValue, valueAad } from "./vault-crypto";
import {
	loadVault,
	requireVaultKey,
	subscribeVault,
	vaultKey,
	vaultState,
} from "./vault-session";

/** `aad \0 ciphertext` → plaintext; a ciphertext's IV makes it unique. */
const plain = new Map<string, string>();
const unreadable = new Set<string>();
const pending = new Map<string, Promise<void>>();
let version = 0;
const listeners = new Set<() => void>();

const cacheId = (aad: string, cipher: string): string =>
	`${aad}\u0000${cipher}`;

function changed(): void {
	version += 1;
	for (const listener of listeners) listener();
}

function decrypt(aad: string, cipher: string): Promise<void> {
	const id = cacheId(aad, cipher);
	const key = vaultKey();
	const running = pending.get(id);
	if (running) return running;
	if (!key || plain.has(id) || unreadable.has(id)) return Promise.resolve();
	const work = openValue(key, cipher, aad)
		.then((text) => {
			plain.set(id, text);
		})
		.catch(() => {
			// Another vault's value, or one moved onto another name.
			unreadable.add(id);
		})
		.finally(() => {
			pending.delete(id);
			changed();
		});
	pending.set(id, work);
	return work;
}

/**
 * Waits until the vault values of `scope` are decrypted (when the vault is
 * open), so a send that follows sees them; `openLocalValues` then answers.
 */
export async function settleLocalValues(
	scope: string,
	values: readonly LocalValue[],
): Promise<void> {
	await Promise.all(
		values
			.filter((entry) => isVaultCiphertext(entry.value))
			.map((entry) => decrypt(valueAad(scope, entry.key), entry.value)),
	);
}

/**
 * The caller's local values of `scope` as they can be used now: vault
 * values decrypted when possible, else `locked` (value empty).
 */
export function openLocalValues(
	scope: string,
	values: readonly LocalValue[],
): LocalValue[] {
	return values.map((entry) => {
		if (!isVaultCiphertext(entry.value)) return entry;
		const aad = valueAad(scope, entry.key);
		const id = cacheId(aad, entry.value);
		const known = plain.get(id);
		if (known !== undefined) return { ...entry, value: known };
		if (!unreadable.has(id)) void decrypt(aad, entry.value);
		return { ...entry, value: "", locked: true };
	});
}

/** Re-renders when decrypted values land or the vault opens or locks. */
export function useVaultValues(): number {
	return useSyncExternalStore(subscribeValues, getVersion, getVersion);
}

const getVersion = (): number => version;

function subscribeValues(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Where a scope's local values are saved, and which names are secrets. */
export interface LocalTarget {
	readonly path: string;
	/** `environment:<id>`, `collection:<id>` or `global:<workspaceId>`. */
	readonly scope: string;
	readonly secretKeys: ReadonlySet<string>;
}

/**
 * Writes as the server takes them: a secret's plain value encrypted for
 * its name (and remembered, so it shows at once). Nothing changes while
 * the server does not run the vault.
 */
export async function sealLocalWrites(
	target: LocalTarget,
	writes: readonly LocalValueWrite[],
): Promise<LocalValueWrite[]> {
	const toSeal = writes.filter(
		(write) =>
			write.value !== null &&
			target.secretKeys.has(write.key) &&
			!isVaultCiphertext(write.value),
	);
	if (toSeal.length === 0) return [...writes];
	if ((await loadVault()).status === "off") return [...writes];
	const key = await requireVaultKey();
	return Promise.all(
		writes.map(async (write) => {
			if (!toSeal.includes(write) || write.value === null) return write;
			const aad = valueAad(target.scope, write.key);
			const sealed = await sealValue(key, write.value, aad);
			plain.set(cacheId(aad, sealed), write.value);
			return { ...write, value: sealed };
		}),
	);
}

// Opening the vault decrypts again what was seen while locked; locking or
// resetting it forgets every plaintext.
subscribeVault(() => {
	if (vaultKey() === null) plain.clear();
	unreadable.clear();
	changed();
});

/** Names whose local value belongs in the vault (secret variables). */
export function secretNames(
	variables: readonly { key: string; type?: string; secret?: boolean }[],
): Set<string> {
	return new Set(
		variables
			.filter(
				(variable) => variable.type === "secret" || variable.secret === true,
			)
			.map((variable) => variable.key.trim()),
	);
}

/** Scope names as the server stores them. */
export const environmentScope = (id: string): string => `environment:${id}`;
export const globalsScope = (workspaceId: string): string =>
	`global:${workspaceId}`;
export const collectionScope = (id: string): string => `collection:${id}`;

/** `openLocalValues` of an environment, a collection or a workspace's globals. */
export function openScopeValues(
	kind: "environment" | "collection" | "global",
	id: string,
	values: readonly LocalValue[],
): LocalValue[] {
	const scope =
		kind === "environment"
			? environmentScope(id)
			: kind === "collection"
				? collectionScope(id)
				: globalsScope(id);
	return openLocalValues(scope, values);
}

/** Whether the server runs the vault (decided once it answered). */
export const vaultRunning = (): boolean => {
	const { status } = vaultState();
	return status !== "off" && status !== "loading";
};
