/**
 * Rows of a variable table: each variable's definition and shared value
 * with the caller's local value, plus local values a script set without
 * a definition. Pure, so the table and its tests read the same rules.
 */
import type { VariableView } from "@localman/shared/api-client";
import type { AgentUseSubject } from "../secure-vault/agent-use/agent-use-types";
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
	/**
	 * The local value is in the vault and cannot be read now (`local` is
	 * then empty): it cannot be shown, copied or shared until unlocked.
	 */
	locked?: true;
	/**
	 * With `locked`: sealed by another vault, so unlocking does not help;
	 * the value can only be replaced or removed.
	 */
	unreadable?: true;
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

/**
 * `local`: the readable local values; `locked`: names whose value is
 * locked in the vault (`true`: for good, sealed by another vault).
 */
export function rowsOf(
	drafts: readonly DraftVariable[],
	local: ReadonlyMap<string, string>,
	locked: ReadonlyMap<string, boolean> = new Map(),
): VariableRow[] {
	const lockedFlags = (key: string) => {
		const unreadable = locked.get(key);
		if (unreadable === undefined) return {};
		return unreadable
			? { locked: true as const, unreadable: true as const }
			: { locked: true as const };
	};
	const defined = drafts.map((variable): VariableRow => {
		const localKey = variable.savedKey ?? variable.key;
		const own =
			localKey === ""
				? undefined
				: (local.get(localKey) ?? (locked.has(localKey) ? "" : undefined));
		const edited =
			own !== undefined &&
			(variable.sharedHidden || own !== (variable.sharedValue ?? ""));
		return {
			variable,
			localKey,
			local: own,
			localOnly: false,
			sync: edited ? "edited" : "synced",
			...(own !== undefined ? lockedFlags(localKey) : {}),
		};
	});
	const names = new Set(
		drafts.map((variable) => variable.savedKey ?? variable.key),
	);
	const extra = [
		...local,
		...[...locked.keys()].map((key) => [key, ""] as const),
	]
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
				...lockedFlags(key),
			};
		});
	return [...defined, ...extra];
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

/** A secret row as "Let agents use" needs it (by its saved name). */
export function agentSubjectOf(row: VariableRow): AgentUseSubject {
	const { variable } = row;
	const local = row.local ?? "";
	return {
		key: row.localKey,
		local: row.locked || local === "" ? null : local,
		hasLocal: row.locked === true || local !== "",
		hasShared: variable.sharedHidden || (variable.sharedValue ?? "") !== "",
	};
}
