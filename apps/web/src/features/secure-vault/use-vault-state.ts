import { useEffect, useSyncExternalStore } from "react";
import {
	type VaultState,
	loadVault,
	subscribeVault,
	vaultState,
} from "./vault-session";

/** The vault as known so far, without asking the server (no request). */
export function useKnownVaultState(): VaultState {
	return useSyncExternalStore(subscribeVault, vaultState, vaultState);
}

/** The vault, read from the server once per page. */
export function useVaultState(): VaultState {
	const snapshot = useKnownVaultState();
	useEffect(() => {
		void loadVault().catch(() => undefined);
	}, []);
	return snapshot;
}
