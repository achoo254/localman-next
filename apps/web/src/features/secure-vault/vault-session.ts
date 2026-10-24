/**
 * The vault on this page: whether the server runs it, whether the user
 * has one, and the unlocked key. A module store (no React): the API layer
 * seals and opens values outside components (`use-vault-state.ts` reads it).
 * - `off`: the server does not run the vault; local values go as before.
 * - `none`: no vault yet; a secret's local value cannot be saved.
 * - `locked` / `unlocked`: the key is (not) on this device.
 */
import type { SecretVaultParams } from "@localman/shared/api-client";
import { peekCurrentUser } from "../auth/use-current-user";
import {
	fetchVaultParams,
	resetVaultOnServer,
	saveVaultParams,
} from "./vault-api";
import { announceVault, listenToVault } from "./vault-broadcast";
import { createVault, unlockVault } from "./vault-crypto";
import {
	forgetVaultKeys,
	recallVaultKey,
	rememberVaultKey,
} from "./vault-key-store";

export type VaultStatus = "loading" | "off" | "none" | "locked" | "unlocked";

export interface VaultState {
	readonly status: VaultStatus;
	readonly params: SecretVaultParams | null;
}

const LOADING: VaultState = { status: "loading", params: null };
let state: VaultState = LOADING;
let key: CryptoKey | null = null;
let loading: Promise<VaultState> | null = null;
/** Bumped by a reload: an answer to an older read is dropped. */
let generation = 0;
const listeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

function setState(next: VaultState, nextKey: CryptoKey | null): void {
	state = next;
	key = nextKey;
	for (const listener of listeners) listener();
}

/** Called on every change of status or key. */
export function subscribeVault(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Called once a reset (here or in another tab) dropped the vault values. */
export function onVaultReset(listener: () => void): () => void {
	resetListeners.add(listener);
	return () => resetListeners.delete(listener);
}

const subOf = (): string | null => {
	const user = peekCurrentUser();
	return user.status === "authenticated" ? user.user.sub : null;
};

/** Reads the vault once per page (again after `reloadVault`). */
export function loadVault(): Promise<VaultState> {
	if (state.status !== "loading") return Promise.resolve(state);
	if (loading) return loading;
	const read = generation;
	const work = (async () => {
		try {
			const params = await fetchVaultParams();
			const sub = params ? subOf() : null;
			const known =
				params && sub ? await recallVaultKey(sub, params.salt) : null;
			if (read !== generation) return state;
			if (params === undefined) setState({ status: "off", params: null }, null);
			else if (params === null)
				setState({ status: "none", params: null }, null);
			else setState({ status: known ? "unlocked" : "locked", params }, known);
		} finally {
			if (read === generation) loading = null;
		}
		return state;
	})();
	loading = work;
	return work;
}

/** Forgets what is known and asks the server again (key dropped). */
export function reloadVault(): Promise<VaultState> {
	generation += 1;
	loading = null;
	setState(LOADING, null);
	return loadVault();
}

export function vaultState(): VaultState {
	return state;
}

/** The key, while unlocked on this device. */
export function vaultKey(): CryptoKey | null {
	return key;
}

export async function createNewVault(passphrase: string): Promise<void> {
	const { params, key: created } = await createVault(passphrase);
	const saved = await saveVaultParams(params);
	const sub = subOf();
	if (sub) await rememberVaultKey(sub, saved.salt, created);
	setState({ status: "unlocked", params: saved }, created);
}

/** `WrongPassphraseError` (from vault-crypto) when it does not open. */
export async function unlockWith(passphrase: string): Promise<void> {
	const { params } = state;
	if (!params) throw new Error("No vault to unlock");
	const opened = await unlockVault(params, passphrase);
	const sub = subOf();
	if (sub) await rememberVaultKey(sub, params.salt, opened);
	setState({ status: "unlocked", params }, opened);
}

/**
 * Locks this tab first (the key leaves memory even if storage fails),
 * then forgets the account's key on this device and tells other tabs.
 * Signing out locks too.
 */
export async function lockVault(): Promise<void> {
	if (state.params) setState({ status: "locked", params: state.params }, null);
	announceVault("lock");
	const sub = subOf();
	if (sub) await forgetVaultKeys(sub);
}

/** Forgot the passphrase: the encrypted values go; a new vault can start. */
export async function resetVault(): Promise<number> {
	const deleted = await resetVaultOnServer();
	setState({ status: "none", params: null }, null);
	announceVault("reset");
	for (const listener of resetListeners) listener();
	const sub = subOf();
	if (sub) await forgetVaultKeys(sub);
	return deleted;
}

listenToVault((event) => {
	if (event === "lock") {
		if (state.params)
			setState({ status: "locked", params: state.params }, null);
		return;
	}
	void reloadVault().catch(() => undefined);
	for (const listener of resetListeners) listener();
});

/** What the UI must ask for before a value can be encrypted. */
export type VaultNeed = "create" | "unlock";

/** Shows the create or unlock dialog; resolves `true` once it is open. */
type VaultPrompt = (need: VaultNeed) => Promise<boolean>;
let prompt: VaultPrompt | null = null;
let asking: Promise<boolean> | null = null;

/** Installed by the vault dialogs while mounted. */
export function setVaultPrompt(next: VaultPrompt | null): void {
	prompt = next;
}

export class VaultLockedError extends Error {
	constructor() {
		super("The vault is locked");
		this.name = "VaultLockedError";
	}
}

/**
 * The key to encrypt with: asks the user to create or unlock the vault
 * when needed (every caller waiting at once shares that one dialog);
 * `VaultLockedError` when they do not.
 */
export async function requireVaultKey(): Promise<CryptoKey> {
	const current = await loadVault();
	if (key) return key;
	if (prompt) {
		const need: VaultNeed = current.status === "none" ? "create" : "unlock";
		asking ??= prompt(need).finally(() => {
			asking = null;
		});
		if ((await asking) && key) return key;
	}
	throw new VaultLockedError();
}

/** TEST ONLY. Back to a fresh page. */
export function resetVaultSession(): void {
	generation += 1;
	loading = null;
	asking = null;
	setState(LOADING, null);
}
