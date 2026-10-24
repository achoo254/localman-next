import { IconLock } from "@tabler/icons-react";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { VaultStatus } from "../secure-vault/vault-session";
import { useUnlockVault } from "./use-vault-ui";

/**
 * - `locked`: the caller's value is in the vault, which is locked.
 * - `empty`: no value yet, and the vault is locked.
 * - `none`: no value yet, and no vault to put one in.
 */
export type VaultCellState = "locked" | "empty" | "none";

/**
 * Whether a secret's own value shows as the vault action instead of a
 * box: typing there could not be saved until the vault opens.
 */
export function vaultCellState(
	status: VaultStatus | null,
	row: { secret: boolean; locked: boolean; hasLocal: boolean },
): VaultCellState | null {
	if (status === null) return null;
	if (row.locked) return "locked";
	if (!row.secret || row.hasLocal) return null;
	if (status === "none") return "none";
	return status === "locked" ? "empty" : null;
}

const MASK = "••••••••";

export interface VaultValueCellProps {
	state: VaultCellState;
	/** Only a closed vault opens a dialog; open, the value is on its way. */
	vault: VaultStatus | null;
	/** The variable's name, for the accessible name. */
	name: string;
	className?: string;
	/** Runs once the vault is open (focus the box that replaces this). */
	onOpen?: () => void;
}

/** The own value of a secret that the vault keeps out of reach for now. */
export function VaultValueCell({
	state,
	vault,
	name,
	className,
	onOpen,
}: VaultValueCellProps) {
	const t = useT();
	const unlock = useUnlockVault();
	const label = {
		locked: t("agentUse.vault.cell.lockedLabel", { name }),
		empty: t("agentUse.vault.cell.emptyLabel", { name }),
		none: t("agentUse.vault.cell.noneLabel", { name }),
	}[state];
	const action = {
		locked: t("agentUse.vault.cell.locked"),
		empty: t("agentUse.vault.cell.emptyAction"),
		none: t("agentUse.vault.cell.noneAction"),
	}[state];
	return (
		<button
			type="button"
			aria-label={label}
			aria-haspopup={
				vault === "none" || vault === "locked" ? "dialog" : undefined
			}
			data-id={
				state === "none" ? "var-table-value-novault" : "var-table-value-locked"
			}
			className={cn(
				controlClassName,
				"flex min-h-9 w-full min-w-24 cursor-pointer items-center gap-2 px-2 text-left text-xs",
				className,
			)}
			onClick={() => unlock(onOpen)}
		>
			<IconLock
				size={14}
				aria-hidden="true"
				className="flex-none text-icon-muted"
			/>
			{state === "locked" ? (
				<span aria-hidden="true" className="font-mono">
					{MASK}
				</span>
			) : (
				<span className="min-w-0 truncate text-muted">
					{t(
						state === "none"
							? "agentUse.vault.cell.none"
							: "agentUse.vault.cell.empty",
					)}
				</span>
			)}
			<span className="ml-auto flex-none font-semibold text-primary">
				{action}
			</span>
		</button>
	);
}
