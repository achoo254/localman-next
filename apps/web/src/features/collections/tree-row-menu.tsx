import {
	IconArrowsTransferUp,
	IconBookmarkPlus,
	IconCopy,
	IconDots,
	IconDownload,
	IconFolderPlus,
	IconLink,
	IconPencil,
	IconPlus,
	IconShare,
	IconTrash,
} from "@tabler/icons-react";
import { Fragment, type ReactNode, useRef } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import type { TreeRow } from "./tree-rows";

export const TREE_ACTIONS = [
	"addRequest",
	"addFolder",
	"addExample",
	"rename",
	"duplicate",
	"share",
	"copyLink",
	"move",
	"export",
	"delete",
] as const;
export type TreeAction = (typeof TREE_ACTIONS)[number];

/** Groups of each kind's menu, separated by a line. */
const MENUS: Record<TreeRow["kind"], readonly (readonly TreeAction[])[]> = {
	collection: [
		["addRequest", "addFolder"],
		["rename", "duplicate", "share", "copyLink", "move"],
		["export", "delete"],
	],
	folder: [
		["addRequest", "addFolder", "rename", "duplicate", "copyLink"],
		["delete"],
	],
	request: [["addExample", "rename", "duplicate", "copyLink"], ["delete"]],
	example: [["rename", "duplicate", "copyLink"], ["delete"]],
};

/** What a Viewer (no `edit` on the collection) still sees. */
const READ_ONLY: ReadonlySet<TreeAction> = new Set([
	"share",
	"copyLink",
	"export",
]);

/** What the caller may do with a row's collection. */
export interface TreePermissions {
	/** Editor role on the collection (own or shared). */
	edit: boolean;
	/** Moving and deleting it also needs Admin or Editor in its workspace. */
	manage: boolean;
	/** Adding collections to the workspace (duplicate lands there). */
	add: boolean;
}

function allowed(
	kind: TreeRow["kind"],
	action: TreeAction,
	can: TreePermissions,
): boolean {
	if (READ_ONLY.has(action)) return true;
	if (kind === "collection" && (action === "move" || action === "delete")) {
		return can.edit && can.manage;
	}
	if (kind === "collection" && action === "duplicate") return can.add;
	return can.edit;
}

/** The menu of a row: each action only for those who may do it. */
export function menuActions(
	kind: TreeRow["kind"],
	can: TreePermissions,
): TreeAction[][] {
	return MENUS[kind]
		.map((group) => group.filter((action) => allowed(kind, action, can)))
		.filter((group) => group.length > 0);
}

const ICONS: Record<TreeAction, ReactNode> = {
	addRequest: <IconPlus size={16} aria-hidden="true" />,
	addFolder: <IconFolderPlus size={16} aria-hidden="true" />,
	addExample: <IconBookmarkPlus size={16} aria-hidden="true" />,
	rename: <IconPencil size={16} aria-hidden="true" />,
	duplicate: <IconCopy size={16} aria-hidden="true" />,
	share: <IconShare size={16} aria-hidden="true" />,
	copyLink: <IconLink size={16} aria-hidden="true" />,
	move: <IconArrowsTransferUp size={16} aria-hidden="true" />,
	export: <IconDownload size={16} aria-hidden="true" />,
	delete: <IconTrash size={16} aria-hidden="true" />,
};

const DATA_IDS: Record<TreeAction, string> = {
	addRequest: "node-menu-add-request",
	addFolder: "node-menu-add-folder",
	addExample: "node-menu-add-example",
	rename: "node-menu-rename",
	duplicate: "node-menu-duplicate",
	share: "node-menu-share",
	copyLink: "node-menu-copy-link",
	move: "node-menu-move",
	export: "node-menu-export",
	delete: "node-menu-delete",
};

export interface TreeRowMenuProps {
	row: TreeRow;
	can: TreePermissions;
	/** Only the focused row's buttons are in the tab order. */
	tabIndex: 0 | -1;
	className: string;
	onAction: (action: TreeAction, row: TreeRow) => void;
}

/** "…" menu of a collection, folder or request row. */
export function TreeRowMenu({
	row,
	can,
	tabIndex,
	className,
	onAction,
}: TreeRowMenuProps) {
	const t = useT();
	const groups = menuActions(row.kind, can);
	// Rename starts once the menu has let go of focus (it traps it while
	// open), and focus then stays in the name box.
	const renameNext = useRef(false);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={t("collections.row.more", { name: row.name })}
				data-id="sidebar-tree-more"
				tabIndex={tabIndex}
				className={className}
				// The row would take the click as "open".
				onClick={(event) => event.stopPropagation()}
			>
				<IconDots size={16} aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				data-id="node-menu"
				align="start"
				onCloseAutoFocus={(event) => {
					if (!renameNext.current) return;
					renameNext.current = false;
					event.preventDefault();
					onAction("rename", row);
				}}
			>
				{groups.map((group, index) => (
					<Fragment key={group.join()}>
						{index > 0 ? <DropdownMenuSeparator /> : null}
						{group.map((action) => (
							<DropdownMenuItem
								key={action}
								data-id={DATA_IDS[action]}
								danger={action === "delete"}
								icon={ICONS[action]}
								className="pointer-coarse:min-h-11"
								onSelect={() => {
									if (action === "rename") renameNext.current = true;
									else onAction(action, row);
								}}
							>
								{t(`collections.menu.${action}`)}
							</DropdownMenuItem>
						))}
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
