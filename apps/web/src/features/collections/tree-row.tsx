import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties, KeyboardEvent } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { type PickMode, pickMode } from "./open-row";
import { RenameInput } from "./rename-input";
import type { DropPosition } from "./tree-drop";
import {
	type TreeAction,
	type TreePermissions,
	TreeRowMenu,
} from "./tree-row-menu";
import {
	FavoriteButton,
	HOVER_ONLY,
	ROW_BUTTON,
	RowLead,
} from "./tree-row-parts";
import { type TreeRow, isBranch } from "./tree-rows";

export interface TreeRowViewProps {
	row: TreeRow;
	/** The tree's single tab stop. */
	focused: boolean;
	/** The row last moved to or opened; highlighted. */
	selected: boolean;
	/** Picked for a bulk delete (Ctrl/Cmd- or Shift-click). */
	picked: boolean;
	/** The tree allows picking: `aria-selected` then means "picked". */
	multiSelectable: boolean;
	/** Its tab is the active one. */
	opened: boolean;
	renaming: boolean;
	can: TreePermissions;
	draggable: boolean;
	/** Drop mark while an item is dragged over this row. */
	drop: DropPosition | null;
	onFocusRow: (row: TreeRow) => void;
	onActivate: (row: TreeRow, mode: PickMode) => void;
	/** Tree keys (arrows, Home/End, F2); true when handled. */
	onTreeKey: (event: KeyboardEvent<HTMLElement>, row: TreeRow) => boolean;
	onFavorite: (row: TreeRow) => void;
	onAction: (action: TreeAction, row: TreeRow) => void;
	onRenameDone: (row: TreeRow, name: string | null, byKey: boolean) => void;
	registerRef: (id: string, element: HTMLElement | null) => void;
}

const DROP_MARK: Record<DropPosition, string> = {
	before:
		"before:absolute before:-top-px before:right-1 before:left-(--indent) before:h-0.5 before:rounded-full before:bg-primary",
	after:
		"after:absolute after:right-1 after:-bottom-px after:left-(--indent) after:h-0.5 after:rounded-full after:bg-primary",
	inside: "shadow-[inset_0_0_0_2px_var(--c-primary)]",
};

/** 6px, then 14px a level (prototype), as spacing units. */
function indentStyle(
	depth: number,
): CSSProperties & Record<"--indent", string> {
	return { "--indent": `calc(var(--spacing) * ${1.5 + depth * 3.5})` };
}

/** One row of the collections tree (`role="treeitem"`). */
export function TreeRowView(props: TreeRowViewProps) {
	const t = useT();
	const { row, focused, renaming } = props;
	const drag = useDraggable({
		id: row.id,
		data: row,
		disabled: !props.draggable || row.kind === "collection" || renaming,
	});
	const drop = useDroppable({ id: row.id, data: row });
	const expanded = isBranch(row) ? row.expanded : undefined;
	const tab = focused ? 0 : -1;

	const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
		// Keys typed in the row's buttons or rename box are theirs.
		if (event.target !== event.currentTarget) return;
		if (props.onTreeKey(event, row)) return;
		drag.listeners?.onKeyDown?.(event);
	};

	return (
		<li role="presentation">
			<div
				ref={(element) => {
					drag.setNodeRef(element);
					drop.setNodeRef(element);
					props.registerRef(row.id, element);
				}}
				role="treeitem"
				aria-level={row.depth + 1}
				aria-expanded={expanded}
				aria-selected={props.multiSelectable ? props.picked : props.selected}
				aria-current={props.opened ? "page" : undefined}
				aria-describedby={drag.attributes["aria-describedby"]}
				tabIndex={tab}
				data-id={`sidebar-tree-${row.kind}`}
				data-node-id={row.id}
				style={indentStyle(row.depth)}
				className={cn(
					"group relative flex min-h-7.5 cursor-pointer select-none items-center gap-1.5 rounded-xs pr-1 pl-(--indent) text-[0.8125rem] outline-none hover:bg-fg/5 focus-visible:shadow-focus-primary pointer-coarse:min-h-10",
					props.selected && "bg-primary/10",
					props.picked &&
						"bg-viz-blue/14 shadow-[inset_2px_0_0_var(--c-viz-blue)]",
					drag.isDragging && "opacity-40",
					props.drop && DROP_MARK[props.drop],
				)}
				onPointerDown={(event) => drag.listeners?.onPointerDown?.(event)}
				onFocus={(event) => {
					if (event.target === event.currentTarget) props.onFocusRow(row);
				}}
				onClick={(event) => props.onActivate(row, pickMode(event))}
				onKeyDown={onKeyDown}
			>
				<RowLead row={row} />
				{renaming ? (
					<RenameInput
						name={row.name}
						onDone={(name, byKey) => props.onRenameDone(row, name, byKey)}
					/>
				) : (
					<span
						title={
							row.kind === "collection" && row.summary.tags.length > 0
								? `${row.name}\n${t("collections.tags.tooltip", { tags: row.summary.tags.join(", ") })}`
								: row.name
						}
						className={cn(
							"min-w-0 flex-1 truncate",
							row.kind === "collection" && "font-semibold",
						)}
					>
						{row.name}
					</span>
				)}
				{row.kind === "collection" ? (
					<FavoriteButton
						name={row.name}
						favorite={row.summary.favorite}
						tabIndex={tab}
						onToggle={() => props.onFavorite(row)}
					/>
				) : null}
				<TreeRowMenu
					row={row}
					can={props.can}
					tabIndex={tab}
					className={cn(
						ROW_BUTTON,
						HOVER_ONLY,
						"data-[state=open]:opacity-100",
					)}
					onAction={props.onAction}
				/>
			</div>
		</li>
	);
}
