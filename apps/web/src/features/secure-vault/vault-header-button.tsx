import { IconLock, IconLockOpen, IconRotate } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { buttonClassName } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useVaultDialogs } from "./vault-dialogs-context";
import { lockVault, useVaultState } from "./vault-session";

const TRIGGER = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"max-sm:size-9 max-sm:px-0 pointer-coarse:max-sm:size-11",
);

const ICON = { size: 16, "aria-hidden": true } as const;

/**
 * Header lock of the secret vault: creates it, unlocks it, or (unlocked)
 * a menu to lock or reset it. Hidden while the state is unknown and when
 * the server does not run the vault. Icon only on small screens.
 */
export function VaultHeaderButton() {
	const t = useT();
	const toast = useToast();
	const dialogs = useVaultDialogs();
	const { status } = useVaultState();
	// Locked and unlocked render different elements (a plain button, a menu
	// trigger): after a change made here, focus moves to the new one.
	const button = useRef<HTMLButtonElement>(null);
	const refocus = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when `status` changes, the moment the button is replaced.
	useEffect(() => {
		if (!refocus.current) return;
		refocus.current = false;
		button.current?.focus();
	}, [status]);
	if (status === "off" || status === "loading") return null;
	const currentButton = () => button.current;

	const state = t(`secretVault.header.state.${status}`);
	const common = {
		ref: button,
		type: "button",
		"aria-label": t("secretVault.header.label", { state }),
		"data-id": "app-header-vault",
		"data-vault": status,
		className: TRIGGER,
	} as const;
	const face = (
		<>
			{status === "unlocked" ? (
				<IconLockOpen {...ICON} />
			) : (
				<IconLock {...ICON} />
			)}
			<span className="max-sm:hidden">{state}</span>
		</>
	);

	if (status !== "unlocked") {
		return (
			<button
				{...common}
				aria-haspopup="dialog"
				onClick={() =>
					dialogs.open(status === "none" ? "create" : "unlock", currentButton)
				}
			>
				{face}
			</button>
		);
	}

	const lock = async () => {
		refocus.current = true;
		try {
			await lockVault();
			toast.show({ tone: "info", title: t("secretVault.lock.locked") });
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button {...common}>{face}</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id="vault-menu">
				<DropdownMenuLabel>{t("secretVault.menu.note")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					data-id="vault-menu-lock"
					icon={<IconLock {...ICON} />}
					onSelect={() => void lock()}
				>
					{t("secretVault.menu.lock")}
				</DropdownMenuItem>
				<DropdownMenuItem
					danger
					data-id="vault-menu-reset"
					icon={<IconRotate {...ICON} />}
					onSelect={() => dialogs.open("reset", currentButton)}
				>
					{t("secretVault.menu.reset")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
