import {
	IconDots,
	IconDownload,
	IconFolder,
	IconLink,
	IconShare,
	IconStack2,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { appPageUrl } from "../../platform/navigation";
import type { CollectionPageTab } from "../api-client/workbench/workbench-tab-types";
import { collectionNodePath } from "../sharing/open-element-state";
import { elementPath } from "../sharing/sharing-api";
import { EditableName } from "./editable-name";
import { PageSaveState } from "./page-save-state";
import { SharedWithYouBadge } from "./shared-with-you-badge";
import { useExportCollection } from "./use-export-collection";
import type { SaveStatus } from "./use-page-autosave";

export interface PageHeaderProps {
	page: CollectionPageTab;
	/** The collection's workspace ("Shared with you" outside the caller's). */
	workspaceId: string;
	name: string;
	collectionName: string;
	canEdit: boolean;
	status: SaveStatus;
	onRename: (name: string) => void;
	onRetry: () => void;
	onShare: () => void;
	/** After the name (a collection's status). */
	extra?: ReactNode;
}

/** Icon, name (editable by Editors), save state, Share and "…". */
export function PageHeader(props: PageHeaderProps) {
	const t = useT();
	const toast = useToast();
	const exportCollection = useExportCollection();
	const { page } = props;
	const Icon = page.kind === "collection" ? IconStack2 : IconFolder;
	const copyLink = async () => {
		const path = page.nodeId
			? collectionNodePath(page.collectionId, page.nodeId)
			: elementPath("collection", page.collectionId);
		const ok = await copyText(appPageUrl(path));
		toast.show(
			ok
				? { tone: "success", title: t("collections.toast.linkCopied") }
				: { tone: "error", title: t("collections.toast.linkFailed") },
		);
	};

	return (
		<header
			data-id="collection-header"
			className="flex flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-3"
		>
			<Icon
				size={20}
				aria-hidden="true"
				className="flex-none text-icon-muted"
			/>
			<EditableName
				name={props.name}
				label={t(`collections.page.nameLabel.${page.kind}`)}
				readOnly={!props.canEdit}
				data-id="collection-name"
				onRename={props.onRename}
			/>
			<SharedWithYouBadge workspaceId={props.workspaceId} />
			{props.extra}
			<PageSaveState status={props.status} onRetry={props.onRetry} />
			<Button
				size="sm"
				variant="secondary"
				data-id="collection-header-share"
				onClick={props.onShare}
			>
				<IconShare size={16} aria-hidden="true" />
				{t("collections.page.share")}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<IconButton
						size="sm"
						data-id="collection-more"
						label={t("collections.row.more", { name: props.name })}
						icon={<IconDots size={18} aria-hidden="true" />}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem
						data-id="collection-more-copy-link"
						icon={<IconLink size={16} aria-hidden="true" />}
						onSelect={() => void copyLink()}
					>
						{t("collections.menu.copyLink")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="collection-more-export"
						icon={<IconDownload size={16} aria-hidden="true" />}
						onSelect={() =>
							void exportCollection(page.collectionId, props.collectionName)
						}
					>
						{t("collections.menu.export")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}
