import type { KeyboardEvent } from "react";
import type { CollectionTreeProps } from "./collection-tree";
import { type TreeRow, isBranch, parentRowId } from "./tree-rows";

/**
 * Keys of the tree (WAI-ARIA tree): ↑/↓, Home/End, →/← to open, close or
 * go to child and parent, Enter opens, F2 renames, Ctrl+Space picks a
 * row, Shift+↑/↓ picks a range, Escape clears the picks. `true` when a
 * key was handled. Nothing while a row is dragged (the arrows move it).
 */
export function treeKeyHandler(
	props: CollectionTreeProps,
	rows: readonly TreeRow[],
	dragging: boolean,
) {
	return (event: KeyboardEvent<HTMLElement>, row: TreeRow): boolean => {
		if (dragging) return false;
		const index = rows.indexOf(row);
		const go = (next: TreeRow | undefined) => {
			if (next) props.onFocusRow(next.id);
		};
		const branch = isBranch(row) ? row : null;
		if (event.key === " " && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			props.onActivate(row, "toggle");
			return true;
		}
		if (
			event.shiftKey &&
			(event.key === "ArrowDown" || event.key === "ArrowUp")
		) {
			const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
			event.preventDefault();
			if (!next) return true;
			if (props.selectedIds.size === 0) props.onActivate(row, "toggle");
			go(next);
			props.onActivate(next, "range");
			return true;
		}
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
				if (branch && !branch.expanded) props.onExpand(row, true);
				else if (rows[index + 1]?.depth === row.depth + 1) {
					go(rows[index + 1]);
				}
				break;
			case "ArrowLeft": {
				if (branch?.expanded) props.onExpand(row, false);
				else go(rows.find((item) => item.id === parentRowId(row)));
				break;
			}
			case "Escape":
				if (props.selectedIds.size === 0) return false;
				props.onClearSelection();
				break;
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
}
