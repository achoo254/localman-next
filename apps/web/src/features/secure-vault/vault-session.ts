/**
 * The vault on this page: whether the server runs it, whether the user
 * has one, and the unlocked key. A module store (no React) because the API
 * layer encrypts and decrypts local values outside components; components
 * read it with `useVaultState`.
 *
 * - `off`: the server does not run the vault; local values go as before.
 * - `none`: no vault yet; a secret's local value cannot be saved.
 * - `locked` / `unlocked`: the key is (not) on this device.
 */
import type { SecretVaultParams } from "@localman/shared/api-client";
import { useEffect, useSyncExternalStore } from "react";
import { peekCurrentUser } from "../auth/use-current-user";
import {
	fetchVaultParams,
	resetVaultOnServer,
	saveVaultParams,
} from "./vault-api";
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

let state: VaultState = { status: "loading", params: null };
let key: CryptoKey | null = null;
let loading: Promise<VaultState> | null = null;
const listeners = new Set<() => void>();

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

const subOf = (): string | null => {
	const user = peekCurrentUser();
	return user.status === "authenticated" ? user.user.sub : null;
};

/** Reads the vault once per page (again after `resetVaultSession`). */
export function loadVault(): Promise<VaultState> {
	if (state.status !== "loading") return Promise.resolve(state);
	loading ??= (async () => {
		try {
			const params = await fetchVaultParams();
			if (params === undefined) setState({ status: "off", params: null }, null);
			else if (params === null)
				setState({ status: "none", params: null }, null);
			else {
				const sub = subOf();
				const known = sub ? await recallVaultKey(sub, params.salt) : null;
				setState({ status: known ? "unlocked" : "locked", params }, known);
			}
		} finally {
			loading = null;
		}
		return state;
	})();
	return loading;
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

export async function lockVault(): Promise<void> {
	await forgetVaultKeys();
	if (state.params) setState({ status: "locked", params: state.params }, null);
}

/** Forgot the passphrase: the encrypted values go; a new vault can start. */
export async function resetVault(): Promise<number> {
	const deleted = await resetVaultOnServer();
	await forgetVaultKeys();
	setState({ status: "none", params: null }, null);
	return deleted;
}

/** What the UI must ask for before a value can be encrypted. */
export type VaultNeed = "create" | "unlock";

/** Shows the create or unlock dialog; resolves `true` once it is open. */
type VaultPrompt = (need: VaultNeed) => Promise<boolean>;
let prompt: VaultPrompt | null = null;

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
 * when needed; `VaultLockedError` when they do not.
 */
export async function requireVaultKey(): Promise<CryptoKey> {
	const current = await loadVault();
	if (key) return key;
	const need: VaultNeed = current.status === "none" ? "create" : "unlock";
	if (prompt && (await prompt(need)) && key) return key;
	throw new VaultLockedError();
}

/** TEST ONLY. Back to a fresh page. */
export function resetVaultSession(): void {
	loading = null;
	setState({ status: "loading", params: null }, null);
}

export function useVaultState(): VaultState {
	const snapshot = useSyncExternalStore(subscribeVault, vaultState, vaultState);
	useEffect(() => {
		void loadVault().catch(() => undefined);
	}, []);
	return snapshot;
}
