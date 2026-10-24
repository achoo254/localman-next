import type { VariableView } from "@localman/shared/api-client";
import { type DraftVariable, duplicateNames } from "./variable-rows";

/**
 * Server variables merged into the drafts being edited: saved rows keep
 * their row id (a new row matched by name takes the server id but keeps
 * its row, so its inputs stay mounted), and rows the server does not
 * have yet (no name, a duplicate name) stay where they were.
 */
export function mergeDrafts(
	current: readonly DraftVariable[],
	server: readonly VariableView[],
): DraftVariable[] {
	const byId = new Map(
		current.filter((v) => !v.isNew).map((v) => [v.id, v] as const),
	);
	const fresh = current.filter((v) => v.isNew);
	const duplicates = duplicateNames(current);
	const used = new Set<string>();
	const merged = server.map((variable): DraftVariable => {
		const known = byId.get(variable.id);
		// Renamed to a name in use: not savable yet, so the typing stays.
		if (known && duplicates.has(known.key.trim())) {
			used.add(known.rowId);
			return { ...known, savedKey: variable.key };
		}
		const matched =
			known ??
			fresh.find((v) => !used.has(v.rowId) && v.key.trim() === variable.key);
		if (matched) used.add(matched.rowId);
		return {
			...variable,
			rowId: matched?.rowId ?? variable.id,
			isNew: false,
			savedKey: variable.key,
		};
	});
	// Unsaved rows go back near where they were typed.
	current.forEach((variable, index) => {
		if (!variable.isNew || used.has(variable.rowId)) return;
		merged.splice(Math.min(index, merged.length), 0, variable);
	});
	return merged;
}
