import {
	COLLECTION_STATUS_PRESETS,
	type CollectionStatus,
} from "@localman/shared/api-client";
import { IconChevronDown, IconMoodPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { buttonClassName } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { CustomStatusModal } from "./custom-status-modal";
import { PRESET_EMOJI, presetLabel, statusDisplay } from "./status-display";

export interface StatusMenuProps {
	status: CollectionStatus | null;
	canEdit: boolean;
	onChange: (status: CollectionStatus | null) => void;
}

/** Status of a collection in its header: presets, a custom one, or none. */
export function StatusMenu({ status, canEdit, onChange }: StatusMenuProps) {
	const t = useT();
	const [custom, setCustom] = useState(false);
	const shown = status ? statusDisplay(status, t) : null;
	const content = shown ? (
		<>
			<span aria-hidden="true">{shown.emoji}</span>
			<span className="max-w-40 truncate">{shown.label}</span>
		</>
	) : (
		<>
			<IconMoodPlus size={16} aria-hidden="true" />
			{t("collections.status.add")}
		</>
	);
	if (!canEdit) {
		return shown ? (
			<span
				data-id="collection-header-status"
				className="inline-flex items-center gap-1.5 text-sm"
			>
				{content}
			</span>
		) : null;
	}
	const current = status?.kind === "preset" ? status.preset : null;
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					data-id="collection-header-status"
					aria-label={t("collections.status.label", {
						status: shown?.label ?? t("collections.status.none"),
					})}
					className={cn(
						buttonClassName({ variant: "ghost", size: "sm" }),
						"gap-1.5",
					)}
				>
					{content}
					<IconChevronDown size={14} aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent data-id="status-menu" align="start">
					<DropdownMenuRadioGroup
						value={current ?? ""}
						onValueChange={(value) => {
							const preset = COLLECTION_STATUS_PRESETS.find(
								(item) => item === value,
							);
							if (preset) onChange({ kind: "preset", preset });
						}}
					>
						{COLLECTION_STATUS_PRESETS.map((preset) => (
							<DropdownMenuRadioItem
								key={preset}
								value={preset}
								data-id="status-menu-preset"
							>
								<span aria-hidden="true">{PRESET_EMOJI[preset]}</span>
								{presetLabel(preset, t)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						data-id="status-menu-custom"
						onSelect={() => setCustom(true)}
					>
						{t("collections.status.custom")}
					</DropdownMenuItem>
					{status ? (
						<DropdownMenuItem
							data-id="status-menu-remove"
							icon={<IconX size={16} aria-hidden="true" />}
							onSelect={() => onChange(null)}
						>
							{t("collections.status.remove")}
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{custom ? (
				<CustomStatusModal
					open
					initial={status?.kind === "custom" ? status : null}
					onOpenChange={setCustom}
					onSave={(next) => {
						onChange(next);
						setCustom(false);
					}}
				/>
			) : null}
		</>
	);
}
