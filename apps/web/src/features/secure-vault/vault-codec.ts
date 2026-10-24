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
} from "./vault-session";

/** `aad \0 ciphertext` → plaintext; a ciphertext's IV makes it unique. */
const plain = new Map<string, string>();
const unreadable = new Set<string>();
/**
 * Ciphertexts the server sent or this page made. Only these pass as
 * already sealed: a secret typed to look like `lmv1:…` is sealed anyway.
 */
const ciphers = new Set<string>();
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
	// Only while the key that did the work is still the vault's key: a
	// lock (or a reset) meanwhile must not leave plaintext behind.
	const current = () => vaultKey() === key;
	const work = openValue(key, cipher, aad)
		.then((text) => {
			if (current()) plain.set(id, text);
		})
		.catch(() => {
			// Another vault's value, or one moved onto another name.
			if (current()) unreadable.add(id);
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
	const sealed = values.filter((entry) => isVaultCiphertext(entry.value));
	if (sealed.length === 0) return;
	// Right after a page load the key may still be on its way from storage.
	await loadVault().catch(() => undefined);
	await Promise.all(
		sealed.map((entry) => {
			ciphers.add(entry.value);
			return decrypt(valueAad(scope, entry.key), entry.value);
		}),
	);
}

/**
 * The caller's local values of `scope` as they can be used now: vault
 * values decrypted when possible, else `locked` (value empty), and also
 * `unreadable` when the open vault cannot decrypt them (another vault's).
 */
export function openLocalValues(
	scope: string,
	values: readonly LocalValue[],
): LocalValue[] {
	return values.map((entry) => {
		if (!isVaultCiphertext(entry.value)) return entry;
		ciphers.add(entry.value);
		const aad = valueAad(scope, entry.key);
		const id = cacheId(aad, entry.value);
		const known = plain.get(id);
		if (known !== undefined) return { ...entry, value: known };
		if (unreadable.has(id)) {
			return { ...entry, value: "", locked: true, unreadable: true };
		}
		void decrypt(aad, entry.value);
		return { ...entry, value: "", locked: true };
	});
}

/** Shorter copies are not looked for: they would match by chance. */
const COPY_MIN_LENGTH = 4;

/** A value of the vault opened on this page, with its variable's name. */
export interface OpenVaultSecret {
	readonly name: string;
	readonly value: string;
}

/**
 * Every value of the vault opened on this page, while it is unlocked and
 * long enough to be looked for: to catch a copy of one about to leave
 * the vault (a script's write, a request that would go to the proxy).
 */
export function openVaultSecrets(): OpenVaultSecret[] {
	if (!vaultKey()) return [];
	return [...plain].flatMap(([id, value]) => {
		// `id` is the scope, the name and the ciphertext (`cacheId`).
		const name = id.split("\u0000")[1] ?? "";
		return value.length >= COPY_MIN_LENGTH ? [{ name, value }] : [];
	});
}

/** The plaintext of `openVaultSecrets`. */
export function openVaultValues(): string[] {
	return openVaultSecrets().map(({ value }) => value);
}

/** A value of the vault opened on this page, while it is unlocked. */
export function isOpenVaultValue(value: string): boolean {
	if (!vaultKey()) return false;
	for (const opened of plain.values()) if (opened === value) return true;
	return false;
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
 * the server does not run the vault. The server is asked about the vault
 * only when a secret's value is about to go; if that read fails, the
 * write fails too (and can be retried) rather than send a secret plain
 * to a server that may run the vault.
 */
export async function sealLocalWrites(
	target: LocalTarget,
	writes: readonly LocalValueWrite[],
): Promise<LocalValueWrite[]> {
	const toSeal = writes.filter(
		(write) =>
			write.value !== null &&
			target.secretKeys.has(write.key) &&
			!ciphers.has(write.value),
	);
	if (toSeal.length === 0) return [...writes];
	if ((await loadVault()).status === "off") return [...writes];
	const key = await requireVaultKey();
	return Promise.all(
		writes.map(async (write) => {
			if (!toSeal.includes(write) || write.value === null) return write;
			const aad = valueAad(target.scope, write.key);
			const sealed = await sealValue(key, write.value, aad);
			ciphers.add(sealed);
			if (vaultKey() === key) plain.set(cacheId(aad, sealed), write.value);
			return { ...write, value: sealed };
		}),
	);
}

// Opening the vault decrypts again what was seen while locked; locking,
// resetting or another vault's key forgets every plaintext.
let seenKey: CryptoKey | null = null;
subscribeVault(() => {
	const now = vaultKey();
	if (now !== seenKey) plain.clear();
	seenKey = now;
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
