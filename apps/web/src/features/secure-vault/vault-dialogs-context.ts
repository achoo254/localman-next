import { createContext, useContext } from "react";

export type VaultDialog = "create" | "unlock" | "reset";

/**
 * Where focus returns when the dialogs close. A function is read at that
 * moment, for an opener that re-renders as another element meanwhile
 * (the header button once the vault opens).
 */
export type VaultDialogOpener = HTMLElement | (() => HTMLElement | null);

export interface VaultDialogs {
	/** Shows a vault dialog; `opener` defaults to the focused element. */
	open: (dialog: VaultDialog, opener?: VaultDialogOpener) => void;
}

/** Provided by `VaultDialogHost` in the app shell. */
export const VaultDialogsContext = createContext<VaultDialogs | null>(null);

export function useVaultDialogs(): VaultDialogs {
	const dialogs = useContext(VaultDialogsContext);
	if (!dialogs) {
		throw new Error("useVaultDialogs must be used inside <VaultDialogHost>");
	}
	return dialogs;
}
