/**
 * The vault as the variable tables show it: its status while the
 * `secretVault` flag is on (`null` otherwise, so nothing changes with the
 * flag off), and the Unlock / Create action of a locked value.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useSecretVaultEnabled } from "../secure-vault/use-secret-vault-enabled";
import {
	VaultLockedError,
	type VaultStatus,
	loadVault,
	requireVaultKey,
	subscribeVault,
	vaultState,
} from "../secure-vault/vault-session";

/** `null` while the flag is off. */
export function useVaultUi(): VaultStatus | null {
	const on = useSecretVaultEnabled();
	const { status } = useSyncExternalStore(
		subscribeVault,
		vaultState,
		vaultState,
	);
	useEffect(() => {
		if (on) void loadVault().catch(() => undefined);
	}, [on]);
	return on ? status : null;
}

/** Whether the vault is in use but its values cannot be read now. */
export const vaultClosed = (status: VaultStatus | null): boolean =>
	status === "none" || status === "locked";

/**
 * Asks to create or unlock the vault (the vault dialogs answer);
 * `onOpen` runs once it is open. Cancelling is not an error.
 */
export function useUnlockVault(): (onOpen?: () => void) => void {
	const toast = useToast();
	const t = useT();
	return useCallback(
		(onOpen?: () => void) => {
			requireVaultKey().then(
				() => onOpen?.(),
				(error: unknown) => {
					if (error instanceof VaultLockedError) return;
					toast.show({ tone: "error", title: t("agentUse.vault.failed") });
				},
			);
		},
		[toast, t],
	);
}
