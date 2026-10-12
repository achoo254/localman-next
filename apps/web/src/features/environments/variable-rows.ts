/**
 * Rows of a variable table: each variable's definition and shared value
 * with the caller's local value, plus local values a script set without
 * a definition. Pure, so the table and its tests read the same rules.
 */
import type { LocalValue, VariableView } from "@localman/shared/api-client";
import type { VariableWrite } from "./environments-api";

/** A variable being edited; new ones have no server id yet. */
export interface DraftVariable extends VariableView {
	/** Stable key of the row while it is edited (the id once saved). */
	rowId: string;
	/** Not on the server yet. */
	isNew: boolean;
	/**
	 * The name the server has. Local values follow it until a rename is
	 * saved, so typing a new name never moves anyone's value on the way.
	 */
	savedKey: string | null;
}

export interface VariableRow {
	variable: DraftVariable;
	/** Name the caller's local value is kept under (the saved name). */
	localKey: string;
	/** The caller's local value; `undefined` when they have none. */
	local: string | undefined;
	/** A local value without a definition (set by a script). */
	localOnly: boolean;
	/** `edited`: the local value differs from the shared one. */
	sync: "synced" | "edited";
}

export function draftsOf(variables: readonly VariableView[]): DraftVariable[] {
	return variables.map((variable) => ({
		...variable,
		rowId: variable.id,
		isNew: false,
		savedKey: variable.key,
	}));
}

export function blankDraft(rowId: string): DraftVariable {
	return {
		id: rowId,
		rowId,
		isNew: true,
		savedKey: null,
		key: "",
		type: "default",
		enabled: true,
		description: "",
		sharedValue: null,
		sharedHidden: false,
	};
}

export function rowsOf(
	drafts: readonly DraftVariable[],
	local: ReadonlyMap<string, string>,
): VariableRow[] {
	const defined = drafts.map((variable): VariableRow => {
		const localKey = variable.savedKey ?? variable.key;
		const own = localKey === "" ? undefined : local.get(localKey);
		const edited =
			own !== undefined &&
			(variable.sharedHidden || own !== (variable.sharedValue ?? ""));
		return {
			variable,
			localKey,
			local: own,
			localOnly: false,
			sync: edited ? "edited" : "synced",
		};
	});
	const names = new Set(
		drafts.map((variable) => variable.savedKey ?? variable.key),
	);
	const extra = [...local]
		.filter(([key]) => !names.has(key))
		.map(([key, value]): VariableRow => {
			const variable = {
				...blankDraft(`local:${key}`),
				key,
				isNew: false,
				savedKey: key,
			};
			return {
				variable,
				localKey: key,
				local: value,
				localOnly: true,
				sync: "edited",
			};
		});
	return [...defined, ...extra];
}

/** Local values after unsaved edits (`null`: reset to shared). */
export function mergedLocal(
	saved: readonly LocalValue[],
	pending: Readonly<Record<string, string | null | undefined>>,
): Map<string, string> {
	const map = new Map(saved.map((entry) => [entry.key, entry.value]));
	for (const [key, value] of Object.entries(pending)) {
		if (value === null) map.delete(key);
		else if (value !== undefined) map.set(key, value);
	}
	return map;
}

/** What an Editor sends: named rows only; ids of saved variables kept. */
export function toWrites(drafts: readonly DraftVariable[]): VariableWrite[] {
	return drafts
		.filter((variable) => variable.key.trim() !== "")
		.map((variable) => ({
			...(variable.isNew ? {} : { id: variable.id }),
			key: variable.key.trim(),
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			sharedValue: variable.sharedValue,
		}));
}

/** Names used by more than one row (they cannot be saved). */
export function duplicateNames(drafts: readonly DraftVariable[]): Set<string> {
	const seen = new Set<string>();
	const twice = new Set<string>();
	for (const { key } of drafts) {
		const name = key.trim();
		if (name === "") continue;
		if (seen.has(name)) twice.add(name);
		seen.add(name);
	}
	return twice;
}

/** The value a send uses: the local one, else the shared one. */
export function currentValue(row: VariableRow): string | null {
	return row.local ?? row.variable.sharedValue;
}

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

/** Saved rows whose name changed: their local values move once saved. */
export function renamesOf(
	drafts: readonly DraftVariable[],
): { from: string; to: string }[] {
	return drafts.flatMap((variable) => {
		const to = variable.key.trim();
		const from = variable.savedKey;
		return from !== null && to !== "" && from !== to ? [{ from, to }] : [];
	});
}
