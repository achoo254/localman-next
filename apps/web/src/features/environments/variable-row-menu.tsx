import {
	IconArrowBackUp,
	IconCloudUpload,
	IconCopy,
	IconDots,
	IconLock,
	IconTrash,
} from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { AgentUseMenuItems } from "../secure-vault/agent-use/agent-use-menu-items";
import type { AgentUseScope } from "../secure-vault/agent-use/agent-use-types";
import type { VaultStatus } from "../secure-vault/vault-session";
import {
	canReset,
	canUnshare,
	isShared,
	shareActionOf,
} from "./variable-batch";
import {
	type VariableRow,
	agentSubjectOf,
	currentValue,
} from "./variable-rows";

export interface VariableRowMenuProps {
	row: VariableRow;
	canEdit: boolean;
	/** Name shown in labels ("Row 3" while the name is empty). */
	label: string;
	onShare: () => void;
	onReset: () => void;
	onUnshare: () => void;
	onCopy: (value: string) => void;
	onDelete: () => void;
	/** `null` with the `secretVault` flag off. */
	vault: VaultStatus | null;
	/** "Let agents use" of a secret row, else `null`. */
	agentUse: AgentUseScope | null;
}

/**
 * More of one variable: share the local value (or update the shared one
 * with it), reset the local value, unshare, copy the value in use, delete.
 * Only what applies to the row is offered. A local value locked in the
 * vault cannot be read: sharing or copying it waits until it is unlocked.
 */
export function VariableRowMenu(props: VariableRowMenuProps) {
	const t = useT();
	const { row, canEdit } = props;
	const value = currentValue(row);
	const shareAction = shareActionOf(row, canEdit);
	const locked = row.locked === true;
	const lockedHint = locked ? (
		<span className="ml-auto pl-3 text-muted text-xs">
			{t(
				props.vault === "none"
					? "agentUse.vault.needCreate"
					: "agentUse.vault.needUnlock",
			)}
		</span>
	) : null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-id="var-table-more"
				aria-label={t("environments.table.more", { name: props.label })}
				className="grid size-8 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-icon-muted hover:bg-fg/6 hover:text-fg pointer-coarse:size-10"
			>
				<IconDots size={16} aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{props.agentUse ? (
					<AgentUseMenuItems
						scope={props.agentUse}
						subject={agentSubjectOf(row)}
					/>
				) : null}
				{locked && canEdit ? (
					<DropdownMenuItem
						disabled
						data-id={
							isShared(row) ? "var-menu-update-shared" : "var-menu-share"
						}
						icon={<IconCloudUpload size={16} aria-hidden="true" />}
					>
						{isShared(row)
							? t("environments.table.updateShared")
							: t("environments.table.shareValue")}
						{lockedHint}
					</DropdownMenuItem>
				) : null}
				{shareAction ? (
					<DropdownMenuItem
						data-id={
							shareAction === "share"
								? "var-menu-share"
								: "var-menu-update-shared"
						}
						icon={<IconCloudUpload size={16} aria-hidden="true" />}
						onSelect={props.onShare}
					>
						{shareAction === "share"
							? t("environments.table.shareValue")
							: t("environments.table.updateShared")}
					</DropdownMenuItem>
				) : null}
				{canReset(row) ? (
					<DropdownMenuItem
						data-id="var-menu-reset"
						icon={<IconArrowBackUp size={16} aria-hidden="true" />}
						onSelect={props.onReset}
					>
						{t("environments.table.resetValue")}
					</DropdownMenuItem>
				) : null}
				{canUnshare(row, canEdit) ? (
					<DropdownMenuItem
						data-id="var-menu-unshare"
						icon={<IconLock size={16} aria-hidden="true" />}
						onSelect={props.onUnshare}
					>
						{t("environments.table.unshare")}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					data-id="var-menu-copy"
					icon={<IconCopy size={16} aria-hidden="true" />}
					disabled={value === null || locked}
					onSelect={() => {
						if (value !== null && !locked) props.onCopy(value);
					}}
				>
					{t("environments.table.copyValue")}
					{lockedHint}
				</DropdownMenuItem>
				{canEdit && !row.localOnly ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							data-id="var-menu-delete"
							icon={<IconTrash size={16} aria-hidden="true" />}
							onSelect={props.onDelete}
						>
							{t("environments.table.delete")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
