import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { KeyboardEvent } from "react";
import { useT } from "../../i18n/i18n-context";
import { TreeRowView } from "./tree-row";
import type { TreeAction, TreePermissions } from "./tree-row-menu";
import { type TreeRow, parentRowId } from "./tree-rows";
import { TreeStatusRow } from "./tree-status-row";
import type { DetailState } from "./use-collections";
import type { useTreeDnd } from "./use-tree-dnd";

export interface CollectionTreeProps {
	rows: readonly TreeRow[];
	details: ReadonlyMap<string, DetailState>;
	labelledBy: string;
	focusId: string | null;
	renamingId: string | null;
	/** Permissions on a collection (by id) for its rows. */
	permissionsOf: (collectionId: string) => TreePermissions;
	dnd: ReturnType<typeof useTreeDnd>;
	onFocusRow: (id: string) => void;
	onActivate: (row: TreeRow) => void;
	onExpand: (row: TreeRow, expanded: boolean) => void;
	onStartRename: (row: TreeRow) => void;
	onFavorite: (row: TreeRow) => void;
	onAction: (action: TreeAction, row: TreeRow) => void;
	onRenameDone: (row: TreeRow, name: string | null, byKey: boolean) => void;
	registerRef: (id: string, element: HTMLElement | null) => void;
}

/**
 * The collections tree: WAI-ARIA tree with one tab stop (↑/↓ move, →/←
 * expand, collapse or go to child and parent, Home/End, Enter opens, F2
 * renames) and drag and drop within a collection.
 */
export function CollectionTree(props: CollectionTreeProps) {
	const t = useT();
	const { rows, dnd } = props;
	const focusId =
		props.focusId !== null && rows.some((row) => row.id === props.focusId)
			? props.focusId
			: (rows[0]?.id ?? null);
	const dragged = rows.find((row) => row.id === dnd.activeId);

	const onTreeKey = (event: KeyboardEvent<HTMLElement>, row: TreeRow) => {
		if (dnd.activeId !== null) return false;
		const index = rows.indexOf(row);
		const go = (next: TreeRow | undefined) => {
			if (next) props.onFocusRow(next.id);
		};
		const branch = row.kind !== "request";
		switch (event.key) {
			case "ArrowDown":
				go(rows[index + 1]);
				break;
			case "ArrowUp":
				go(rows[index - 1]);
				break;
			case "Home":
				go(rows[0]);
				break;
			case "End":
				go(rows[rows.length - 1]);
				break;
			case "ArrowRight":
				if (branch && !row.expanded) props.onExpand(row, true);
				else if (branch && rows[index + 1]?.depth === row.depth + 1) {
					go(rows[index + 1]);
				}
				break;
			case "ArrowLeft": {
				if (branch && row.expanded) props.onExpand(row, false);
				else go(rows.find((item) => item.id === parentRowId(row)));
				break;
			}
			case "Enter":
				props.onActivate(row);
				break;
			case "F2":
				if (!props.permissionsOf(row.collectionId).edit) return false;
				props.onStartRename(row);
				break;
			default:
				return false;
		}
		event.preventDefault();
		return true;
	};

	return (
		<DndContext
			sensors={dnd.sensors}
			collisionDetection={closestCenter}
			onDragStart={dnd.onDragStart}
			onDragMove={dnd.onDragMove}
			onDragOver={dnd.onDragOver}
			onDragEnd={dnd.onDragEnd}
			onDragCancel={dnd.onDragCancel}
			accessibility={{
				screenReaderInstructions: {
					draggable: t("collections.dnd.instructions"),
				},
				announcements: {
					onDragStart: ({ active }) =>
						t("collections.dnd.picked", { name: nameOf(rows, active.id) }),
					onDragOver: ({ over }) =>
						over
							? t("collections.dnd.over", { target: nameOf(rows, over.id) })
							: undefined,
					onDragMove: () => undefined,
					onDragEnd: ({ active }) =>
						t("collections.dnd.dropped", { name: nameOf(rows, active.id) }),
					onDragCancel: ({ active }) =>
						t("collections.dnd.cancelled", { name: nameOf(rows, active.id) }),
				},
			}}
		>
			<ul
				role="tree"
				aria-labelledby={props.labelledBy}
				data-id="sidebar-tree"
				className="m-0 grid list-none gap-px px-1 py-1"
			>
				{rows.map((row) => (
					<TreeEntry
						key={row.id}
						row={row}
						{...props}
						focusId={focusId}
						selectedId={props.focusId}
						draggable={props.permissionsOf(row.collectionId).edit}
						onTreeKey={onTreeKey}
					/>
				))}
			</ul>
			<DragOverlay dropAnimation={null}>
				{dragged ? (
					<div className="inline-flex max-w-60 items-center truncate rounded-xs border border-border bg-surface px-2 py-1 font-mono text-xs shadow-lg">
						{dragged.name}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

function nameOf(rows: readonly TreeRow[], id: string | number): string {
	return rows.find((row) => row.id === String(id))?.name ?? "";
}

type TreeEntryProps = CollectionTreeProps & {
	row: TreeRow;
	/** The row the user last moved to or opened (none at first). */
	selectedId: string | null;
	draggable: boolean;
	onTreeKey: (event: KeyboardEvent<HTMLElement>, row: TreeRow) => boolean;
};

/** A row, plus a loading or error line under an expanded collection. */
function TreeEntry({ row, ...props }: TreeEntryProps) {
	const mark =
		props.dnd.mark?.rowId === row.id ? props.dnd.mark.position : null;
	return (
		<>
			<TreeRowView
				row={row}
				focused={props.focusId === row.id}
				selected={props.selectedId === row.id}
				renaming={props.renamingId === row.id}
				can={props.permissionsOf(row.collectionId)}
				draggable={props.draggable}
				drop={mark}
				onFocusRow={(focused) => props.onFocusRow(focused.id)}
				onActivate={props.onActivate}
				onTreeKey={props.onTreeKey}
				onFavorite={props.onFavorite}
				onAction={props.onAction}
				onRenameDone={props.onRenameDone}
				registerRef={props.registerRef}
			/>
			{row.kind === "collection" &&
			(row.items === "loading" || row.items === "error") ? (
				<TreeStatusRow
					status={row.items}
					onRetry={() => {
						const state = props.details.get(row.id);
						if (state?.status === "error") state.retry();
					}}
				/>
			) : null}
		</>
	);
}
