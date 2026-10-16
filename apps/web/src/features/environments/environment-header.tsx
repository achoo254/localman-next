import type {
	EnvironmentColor,
	EnvironmentDetail,
} from "@localman/shared/api-client";
import {
	IconCircleCheck,
	IconCopy,
	IconDots,
	IconDownload,
	IconLock,
	IconShare,
	IconTrash,
} from "@tabler/icons-react";
import { type ReactNode, useRef } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { EditableName } from "../collections/editable-name";
import { PageSaveState } from "../collections/page-save-state";
import { SharedWithYouBadge } from "../collections/shared-with-you-badge";
import type { SaveStatus } from "../collections/use-page-autosave";
import { RequestEditButton } from "../sharing/request-edit-button";
import { ForkControls } from "../version-control/fork-controls";
import { ColorMenu } from "./environment-color";
import { useRenameRequest } from "./rename-request";
import { useOpenVariablesPage } from "./use-open-variables-page";

export interface EnvironmentHeaderProps {
	environment: EnvironmentDetail;
	/** Name and color with unsaved edits. */
	name: string;
	color: EnvironmentColor;
	active: boolean;
	/** Admin or Editor of the workspace (the copy lands there). */
	canDuplicate: boolean;
	/** Editor of it and Admin or Editor of its workspace. */
	canDelete: boolean;
	status: SaveStatus;
	onRename: (name: string) => void;
	onColor: (color: EnvironmentColor) => void;
	onRetry: () => void;
	onToggleActive: () => void;
	onShare: () => void;
	onDuplicate: () => void;
	onExport: () => void;
	onDelete: () => void;
	/** The "all" actions of the variables, first in More. */
	bulkItems: ReactNode;
}

/**
 * Color, name, Read only and Request to Edit for Viewers, Set active,
 * Share, and More: the "all" actions of the variables, Duplicate, Export
 * and Delete.
 */
export function EnvironmentHeader(props: EnvironmentHeaderProps) {
	const t = useT();
	const { environment } = props;
	const canEdit = environment.role === "editor";
	const { canDuplicate, canDelete } = props;
	const headerRef = useRef<HTMLElement>(null);
	const { openEnvironment } = useOpenVariablesPage();
	useRenameRequest(environment.id, headerRef);
	return (
		<header
			ref={headerRef}
			data-id="environment-header"
			className="flex flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-3"
		>
			<ColorMenu
				color={props.color}
				disabled={!canEdit}
				onChange={props.onColor}
			/>
			<EditableName
				name={props.name}
				label={t("environments.page.nameLabel")}
				readOnly={!canEdit}
				data-id="environment-header-title"
				onRename={props.onRename}
			/>
			<SharedWithYouBadge
				workspaceId={environment.workspaceId}
				data-id="environment-header-shared"
			/>
			{canEdit ? null : (
				<>
					<Badge data-id="environment-header-readonly" tone="neutral">
						<IconLock size={12} aria-hidden="true" />
						{t("environments.page.readOnly")}
					</Badge>
					<RequestEditButton
						elementType="environment"
						elementId={environment.id}
						elementName={environment.name}
						data-id="environment-header-request-edit"
					/>
				</>
			)}
			<PageSaveState status={props.status} onRetry={props.onRetry} />
			<Button
				size="sm"
				variant={props.active ? "primary" : "secondary"}
				aria-pressed={props.active}
				data-id="environment-header-active"
				onClick={props.onToggleActive}
			>
				<IconCircleCheck size={16} aria-hidden="true" />
				{props.active
					? t("environments.page.active")
					: t("environments.page.setActive")}
			</Button>
			<ForkControls
				target={{ kind: "environment", id: environment.id }}
				name={environment.name}
				role={canEdit ? "editor" : "viewer"}
				onOpen={(id) => openEnvironment(id, environment.name)}
			/>
			<Button
				size="sm"
				variant="secondary"
				data-id="environment-header-share"
				onClick={props.onShare}
			>
				<IconShare size={16} aria-hidden="true" />
				{t("environments.page.share")}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<IconButton
						size="sm"
						data-id="environment-header-more"
						label={t("environments.page.more", { name: props.name })}
						icon={<IconDots size={18} aria-hidden="true" />}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{props.bulkItems}
					<DropdownMenuSeparator />
					{canDuplicate ? (
						<DropdownMenuItem
							data-id="env-more-duplicate"
							icon={<IconCopy size={16} aria-hidden="true" />}
							onSelect={props.onDuplicate}
						>
							{t("environments.menu.duplicate")}
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						data-id="env-more-export"
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
								data-id="env-more-delete"
								icon={<IconTrash size={16} aria-hidden="true" />}
								onSelect={props.onDelete}
							>
								{t("environments.menu.delete")}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}
