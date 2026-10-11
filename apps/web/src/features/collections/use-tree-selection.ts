import { useCallback, useState } from "react";
import { rowRange } from "./bulk-plan";
import type { TreeRow } from "./tree-rows";

/**
 * Multi-select of the tree: Ctrl/Cmd-click (or Ctrl+Space) adds or
 * removes a row, Shift-click (or Shift+arrow) adds the rows from the last
 * picked one; Esc or "Clear" empties it. Only rows `canPick` allows join
 * (what the caller may delete).
 */
export function useTreeSelection(
	rows: readonly TreeRow[],
	canPick: (row: TreeRow) => boolean,
) {
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [anchor, setAnchor] = useState<string | null>(null);
	const toggle = useCallback(
		(id: string) => {
			const row = rows.find((item) => item.id === id);
			if (!row || !canPick(row)) return;
			setSelected((current) => {
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
			setAnchor(id);
		},
		[rows, canPick],
	);
	const extend = useCallback(
		(id: string) => {
			const range = anchor ? rowRange(rows, anchor, id) : [id];
			const pickable = new Set(rows.filter(canPick).map((row) => row.id));
			const ids = range.filter((item) => pickable.has(item));
			setSelected((current) => new Set([...current, ...ids]));
			if (!anchor) setAnchor(id);
		},
		[rows, anchor, canPick],
	);
	const clear = useCallback(() => {
		setSelected(new Set());
		setAnchor(null);
	}, []);
	// Rows gone from the tree (deleted, collapsed) no longer count.
	const picked = rows.filter((row) => selected.has(row.id));
	return {
		selected: new Set(picked.map((row) => row.id)),
		picked,
		toggle,
		extend,
		clear,
	};
}
