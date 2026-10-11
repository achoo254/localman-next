import {
	IconDots,
	IconDownload,
	IconFolder,
	IconLink,
	IconShare,
	IconStack2,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
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
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import { elementPath } from "../sharing/sharing-api";
import { PageSaveState } from "./page-save-state";
import { useExportCollection } from "./use-export-collection";
import type { SaveStatus } from "./use-page-autosave";

export interface PageHeaderProps {
	page: PageTab;
	name: string;
	collectionName: string;
	canEdit: boolean;
	status: SaveStatus;
	onRename: (name: string) => void;
	onRetry: () => void;
	onShare: () => void;
}

/** Icon, name (editable by Editors), save state, Share and "…". */
export function PageHeader(props: PageHeaderProps) {
	const t = useT();
	const toast = useToast();
	const exportCollection = useExportCollection();
	const { page } = props;
	const [name, setName] = useState(props.name);
	// A save or refetch elsewhere shows here unless the box is being edited.
	const [editing, setEditing] = useState(false);
	useEffect(() => {
		if (!editing) setName(props.name);
	}, [props.name, editing]);
	const Icon = page.kind === "collection" ? IconStack2 : IconFolder;
	const copyLink = async () => {
		const ok = await copyText(
			appPageUrl(elementPath("collection", page.collectionId)),
		);
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
			<input
				type="text"
				value={name}
				readOnly={!props.canEdit}
				aria-label={t(`collections.page.nameLabel.${page.kind}`)}
				data-id="collection-name"
				maxLength={200}
				className="min-h-9 min-w-0 flex-1 truncate rounded-sm border border-transparent bg-transparent px-2 font-bold font-mono text-base read-only:cursor-default hover:border-border read-only:hover:border-transparent focus:border-primary focus:outline-none"
				onFocus={() => setEditing(true)}
				onBlur={() => {
					setEditing(false);
					setName(props.name);
				}}
				onChange={(event) => {
					setName(event.target.value);
					const next = event.target.value.trim();
					if (next) props.onRename(next);
				}}
			/>
			<PageSaveState status={props.status} onRetry={props.onRetry} />
			<Button
				size="sm"
				variant="secondary"
				data-id="collection-share"
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
