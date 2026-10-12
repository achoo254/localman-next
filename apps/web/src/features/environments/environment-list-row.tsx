import type { EnvironmentSummary } from "@localman/shared/api-client";
import {
	IconCheck,
	IconCircleCheck,
	IconCopy,
	IconDots,
	IconDownload,
	IconLink,
	IconPencil,
	IconShare,
	IconTrash,
} from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { copyText } from "../../platform/clipboard";
import { appPageUrl } from "../../platform/navigation";
import { elementPath } from "../sharing/sharing-api";
import { ColorDot } from "./environment-color";
import { requestRename } from "./rename-request";

export interface EnvironmentListRowProps {
	environment: EnvironmentSummary;
	active: boolean;
	opened: boolean;
	/** Admin or Editor of the workspace: duplicate lands there. */
	canDuplicate: boolean;
	/** Editor of it and Admin or Editor of the workspace. */
	canDelete: boolean;
	onOpen: () => void;
	onToggleActive: () => void;
	onDuplicate: () => void;
	onShare: () => void;
	onExport: () => void;
	onDelete: () => void;
}

/**
 * One environment in the sidebar: color, name, the Set active toggle and
 * its menu (Set active, Rename, Duplicate, Share, Copy link, Export,
 * Delete; only what the caller may do).
 */
export function EnvironmentListRow(props: EnvironmentListRowProps) {
	const t = useT();
	const toast = useToast();
	const { environment, canDuplicate, canDelete } = props;
	const copyLink = async () => {
		const ok = await copyText(
			appPageUrl(elementPath("environment", environment.id)),
		);
		toast.show(
			ok
				? { tone: "success", title: t("environments.menu.linkCopied") }
				: { tone: "error", title: t("environments.table.copyFailed") },
		);
	};
	return (
		<li
			data-id="sidebar-envs-item"
			data-environment={environment.id}
			className={cn(
				"group flex min-h-9 items-center gap-1 rounded-sm pr-1",
				props.opened ? "bg-primary/8" : "hover:bg-fg/4",
			)}
		>
			<button
				type="button"
				data-id="sidebar-envs-item-open"
				aria-current={props.opened ? "page" : undefined}
				className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left text-sm"
				onClick={props.onOpen}
			>
				<ColorDot color={environment.color} />
				<span className="min-w-0 flex-1 truncate">{environment.name}</span>
			</button>
			<IconButton
				size="sm"
				data-id="sidebar-envs-set-active"
				aria-pressed={props.active}
				label={t("environments.sidebar.setActiveOf", {
					name: environment.name,
				})}
				className={props.active ? "text-primary" : undefined}
				icon={
					props.active ? (
						<IconCircleCheck size={16} aria-hidden="true" />
					) : (
						<IconCheck size={16} aria-hidden="true" />
					)
				}
				onClick={props.onToggleActive}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger
					data-id="sidebar-envs-more"
					aria-label={t("environments.page.more", { name: environment.name })}
					className="grid size-8 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-icon-muted hover:bg-fg/6 hover:text-fg pointer-coarse:size-10"
				>
					<IconDots size={16} aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						data-id="env-menu-active"
						icon={<IconCircleCheck size={16} aria-hidden="true" />}
						onSelect={props.onToggleActive}
					>
						{props.active
							? t("environments.sidebar.deactivate")
							: t("environments.page.setActive")}
					</DropdownMenuItem>
					{environment.role === "editor" ? (
						<DropdownMenuItem
							data-id="env-menu-rename"
							icon={<IconPencil size={16} aria-hidden="true" />}
							onSelect={() => {
								props.onOpen();
								requestRename(environment.id);
							}}
						>
							{t("environments.menu.rename")}
						</DropdownMenuItem>
					) : null}
					{canDuplicate ? (
						<DropdownMenuItem
							data-id="env-menu-duplicate"
							icon={<IconCopy size={16} aria-hidden="true" />}
							onSelect={props.onDuplicate}
						>
							{t("environments.menu.duplicate")}
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						data-id="env-menu-share"
						icon={<IconShare size={16} aria-hidden="true" />}
						onSelect={props.onShare}
					>
						{t("environments.menu.share")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="env-menu-copy-link"
						icon={<IconLink size={16} aria-hidden="true" />}
						onSelect={() => void copyLink()}
					>
						{t("environments.menu.copyLink")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="env-menu-export"
						icon={<IconDownload size={16} aria-hidden="true" />}
						onSelect={props.onExport}
					>
						{t("environments.file.export")}
					</DropdownMenuItem>
					{canDelete ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								danger
								data-id="env-menu-delete"
								icon={<IconTrash size={16} aria-hidden="true" />}
								onSelect={props.onDelete}
							>
								{t("environments.menu.delete")}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
