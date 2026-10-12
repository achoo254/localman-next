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
import { type VariableRow, currentValue } from "./variable-rows";

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
}

/**
 * More of one variable: share the local value (or update the shared one
 * with it), reset the local value, unshare, copy the value in use, delete.
 * Only what applies to the row is offered.
 */
export function VariableRowMenu(props: VariableRowMenuProps) {
	const t = useT();
	const { row, canEdit } = props;
	const hasLocal = row.local !== undefined;
	const shared = row.variable.sharedValue !== null || row.variable.sharedHidden;
	const value = currentValue(row);
	const shareAction =
		canEdit && hasLocal && row.sync === "edited"
			? shared && !row.localOnly
				? "update"
				: "share"
			: null;
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
				{shareAction ? (
					<DropdownMenuItem
						data-id={`var-table-${shareAction}`}
						icon={<IconCloudUpload size={16} aria-hidden="true" />}
						onSelect={props.onShare}
					>
						{shareAction === "share"
							? t("environments.table.shareValue")
							: t("environments.table.updateShared")}
					</DropdownMenuItem>
				) : null}
				{hasLocal ? (
					<DropdownMenuItem
						data-id="var-table-reset"
						icon={<IconArrowBackUp size={16} aria-hidden="true" />}
						onSelect={props.onReset}
					>
						{t("environments.table.resetValue")}
					</DropdownMenuItem>
				) : null}
				{canEdit && shared && !row.localOnly ? (
					<DropdownMenuItem
						data-id="var-table-unshare"
						icon={<IconLock size={16} aria-hidden="true" />}
						onSelect={props.onUnshare}
					>
						{t("environments.table.unshare")}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					data-id="var-table-copy"
					icon={<IconCopy size={16} aria-hidden="true" />}
					disabled={value === null}
					onSelect={() => {
						if (value !== null) props.onCopy(value);
					}}
				>
					{t("environments.table.copyValue")}
				</DropdownMenuItem>
				{canEdit && !row.localOnly ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							data-id="var-table-delete"
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
