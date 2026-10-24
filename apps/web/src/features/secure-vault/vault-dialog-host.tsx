import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useSecretVaultEnabled } from "./use-secret-vault-enabled";
import { VaultCreateDialog } from "./vault-create-dialog";
import {
	type VaultDialog,
	type VaultDialogOpener,
	type VaultDialogs,
	VaultDialogsContext,
} from "./vault-dialogs-context";
import { VaultResetDialog } from "./vault-reset-dialog";
import { setVaultPrompt } from "./vault-session";
import { VaultUnlockDialog } from "./vault-unlock-dialog";

interface Shown {
	readonly dialog: VaultDialog;
	/** The create dialog right after a reset. */
	readonly afterReset: boolean;
}

/**
 * The vault dialogs of the signed-in app, mounted once in the shell. Opens
 * them for the header button (`useVaultDialogs`) and for `requireVaultKey`
 * (the prompt it installs while mounted): that promise resolves `true` once
 * the vault is open, through unlock or forgot → reset → create, and `false`
 * when the person closes a dialog without opening it.
 */
export function VaultDialogHost({ children }: { children: ReactNode }) {
	return useSecretVaultEnabled() ? (
		<VaultDialogsRoot>{children}</VaultDialogsRoot>
	) : (
		children
	);
}

function VaultDialogsRoot({ children }: { children: ReactNode }) {
	const t = useT();
	const toast = useToast();
	const [shown, setShown] = useState<Shown | null>(null);
	// Read by close handlers that run right after a hand-over (reset →
	// create) and before the re-render: the state there would be stale.
	const current = useRef<Shown | null>(null);
	const pending = useRef<((open: boolean) => void) | null>(null);
	const opener = useRef<VaultDialogOpener | null>(null);

	const show = useCallback((next: Shown | null) => {
		current.current = next;
		setShown(next);
	}, []);

	const settle = useCallback((open: boolean) => {
		const resolve = pending.current;
		pending.current = null;
		resolve?.(open);
	}, []);

	const open = useCallback<VaultDialogs["open"]>(
		(dialog, from) => {
			const focused = document.activeElement;
			opener.current =
				from ?? (focused instanceof HTMLElement ? focused : null);
			show({ dialog, afterReset: false });
		},
		[show],
	);

	useEffect(() => {
		setVaultPrompt(
			(need) =>
				new Promise<boolean>((resolve) => {
					settle(false); // a newer ask replaces one left unanswered
					pending.current = resolve;
					open(need);
				}),
		);
		return () => {
			setVaultPrompt(null);
			settle(false);
		};
	}, [open, settle]);

	/** Closed without opening the vault; ignored once another took over. */
	const cancel = (dialog: VaultDialog) => {
		if (current.current?.dialog !== dialog) return;
		show(null);
		settle(false);
	};

	const opened = (message: string) => {
		show(null);
		settle(true);
		toast.show({ tone: "success", title: message });
	};

	/** Back to what opened the dialogs, unless another dialog took over. */
	const returnFocus = (event: Event) => {
		event.preventDefault();
		if (current.current) return;
		const from = opener.current;
		const target = typeof from === "function" ? from() : from;
		if (target?.isConnected) target.focus();
	};

	const value = useMemo<VaultDialogs>(() => ({ open }), [open]);

	return (
		<VaultDialogsContext value={value}>
			{children}
			<VaultCreateDialog
				open={shown?.dialog === "create"}
				afterReset={shown?.afterReset ?? false}
				onCancel={() => cancel("create")}
				onCreated={() => opened(t("secretVault.create.created"))}
				onCloseAutoFocus={returnFocus}
			/>
			<VaultUnlockDialog
				open={shown?.dialog === "unlock"}
				onCancel={() => cancel("unlock")}
				onUnlocked={() => opened(t("secretVault.unlock.unlocked"))}
				onForgot={() => show({ dialog: "reset", afterReset: false })}
				onCloseAutoFocus={returnFocus}
			/>
			<VaultResetDialog
				open={shown?.dialog === "reset"}
				onCancel={() => cancel("reset")}
				onReset={(deleted) => {
					toast.show({
						tone: "info",
						title: t("secretVault.reset.done", { count: deleted }),
					});
					show({ dialog: "create", afterReset: true });
				}}
				onCloseAutoFocus={returnFocus}
			/>
		</VaultDialogsContext>
	);
}
