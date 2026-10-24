/**
 * What Share, Update shared value, Reset value and Unshare do, for one
 * row or for all of them ("Share all", "Update all shared values",
 * "Reset all", "Unshare all"). Pure, so the row menu, the "all" menu and
 * the editor read the same rules: an "all" action applies the single-row
 * action to every row that offers it.
 */
import type { LocalValueWrite } from "./local-values-api";
import {
	type DraftVariable,
	type VariableRow,
	blankDraft,
	renamesOf,
} from "./variable-rows";

export type ShareAction = "share" | "update";

/** A shared value exists (withheld from the caller or not). */
export function isShared(row: VariableRow): boolean {
	return row.variable.sharedValue !== null || row.variable.sharedHidden;
}

/**
 * Whether the row offers Share value or Update shared value: an Editor
 * with a local value that differs from the shared one. A local value
 * without a definition is shared as a new variable.
 */
export function shareActionOf(
	row: VariableRow,
	canEdit: boolean,
): ShareAction | null {
	if (!canEdit || row.local === undefined || row.sync !== "edited") return null;
	return isShared(row) && !row.localOnly ? "update" : "share";
}

/** Rows that Reset value applies to: the caller has a local value. */
export function canReset(row: VariableRow): boolean {
	return row.local !== undefined && row.localKey.trim() !== "";
}

/** Rows that Unshare applies to: an Editor, a defined shared variable. */
export function canUnshare(row: VariableRow, canEdit: boolean): boolean {
	return canEdit && isShared(row) && !row.localOnly;
}

export interface BatchTargets {
	share: VariableRow[];
	update: VariableRow[];
	reset: VariableRow[];
	unshare: VariableRow[];
}

/**
 * The rows each "all" action changes. A secret whose shared value is
 * withheld from the caller is left out of the actions that write shared
 * values: they would overwrite or drop a value the caller cannot see.
 * Resetting a local value is the caller's own, so it applies to every row.
 */
export function batchTargets(
	rows: readonly VariableRow[],
	canEdit: boolean,
): BatchTargets {
	const visible = rows.filter((row) => !row.variable.sharedHidden);
	return {
		share: visible.filter((row) => shareActionOf(row, canEdit) === "share"),
		update: visible.filter((row) => shareActionOf(row, canEdit) === "update"),
		reset: rows.filter(canReset),
		unshare: visible.filter((row) => canUnshare(row, canEdit)),
	};
}

/**
 * Drafts after sharing these rows' local values: a defined variable takes
 * its local value as shared value, a local value without a definition
 * becomes a new variable (`newRowId` names its row).
 */
export function sharedDrafts(
	drafts: readonly DraftVariable[],
	rows: readonly VariableRow[],
	newRowId: () => string,
): DraftVariable[] {
	const values = new Map(
		rows
			.filter((row) => !row.localOnly)
			.map((row) => [row.variable.rowId, row.local ?? ""] as const),
	);
	const updated = drafts.map((variable) => {
		const value = values.get(variable.rowId);
		return value === undefined ? variable : { ...variable, sharedValue: value };
	});
	const added = rows
		.filter((row) => row.localOnly)
		.map((row) => ({
			...blankDraft(newRowId()),
			key: row.variable.key,
			sharedValue: row.local ?? "",
		}));
	return [...updated, ...added];
}

/** Drafts after unsharing these rows: their shared value goes. */
export function unsharedDrafts(
	drafts: readonly DraftVariable[],
	rows: readonly VariableRow[],
): DraftVariable[] {
	const ids = new Set(rows.map((row) => row.variable.rowId));
	return drafts.map((variable) =>
		ids.has(variable.rowId) ? { ...variable, sharedValue: null } : variable,
	);
}

/** The local-value patch that resets these rows to their shared value. */
export function resetPatch(rows: readonly VariableRow[]): Record<string, null> {
	return Object.fromEntries(
		rows.filter(canReset).map((row) => [row.localKey, null] as const),
	);
}

/**
 * The caller's local writes once the shared variables are saved: a
 * renamed variable's local value moves to the new name (unless that name
 * has one), and the values just shared (`resets`) go back to shared.
 */
export function localWritesAfterSave(
	drafts: readonly DraftVariable[],
	local: ReadonlyMap<string, string>,
	resets: readonly string[],
): LocalValueWrite[] {
	const moves = renamesOf(drafts).flatMap(({ from, to }) => {
		const value = local.get(from);
		return value === undefined || local.has(to)
			? []
			: [
					{ key: from, value: null },
					{ key: to, value },
				];
	});
	const moved = new Set(moves.map((write) => write.key));
	const cleared = resets
		.filter((key) => local.has(key) && !moved.has(key))
		.map((key) => ({ key, value: null }));
	return [...moves, ...cleared];
}
