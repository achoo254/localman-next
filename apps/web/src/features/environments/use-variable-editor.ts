/**
 * Editing of an environment's or the globals' variables. Editors change
 * definitions and shared values; everyone changes their own local values.
 * Both save on their own once typing pauses (`usePageAutosave`), in order,
 * so a late answer never overwrites a newer edit. Server data is merged
 * into the drafts (`mergeDrafts`), keeping rows not saved yet; a rename
 * moves the caller's local value only after the new name is saved.
 */
import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type SaveStatus,
	usePageAutosave,
} from "../collections/use-page-autosave";
import type { LocalValueWrite, VariableWrite } from "./environments-api";
import {
	type DraftVariable,
	type VariableRow,
	blankDraft,
	draftsOf,
	duplicateNames,
	mergeDrafts,
	mergedLocal,
	renamesOf,
	rowsOf,
	toWrites,
} from "./variable-rows";

export interface VariableEditorOptions {
	variables: readonly VariableView[];
	localValues: readonly LocalValue[];
	canEdit: boolean;
	saveShared: (writes: VariableWrite[]) => Promise<void>;
	saveLocal: (values: LocalValueWrite[]) => Promise<void>;
}

type SharedPatch = { variables: DraftVariable[] };
type LocalPatch = Record<string, string | null>;

const RANK: Record<SaveStatus["state"], number> = {
	idle: 0,
	saved: 1,
	saving: 2,
	error: 3,
};

/** One status for both saves: an error, else saving, else saved. */
export function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
	return RANK[b.state] > RANK[a.state] ? b : a;
}

export function useVariableEditor(options: VariableEditorOptions) {
	const { variables, localValues, canEdit } = options;
	const saveSharedRef = useRef(options.saveShared);
	saveSharedRef.current = options.saveShared;
	const saveLocalRef = useRef(options.saveLocal);
	saveLocalRef.current = options.saveLocal;
	const localRef = useRef(new Map<string, string>());

	const shared = usePageAutosave<SharedPatch>(async (patch) => {
		if (!patch.variables) return;
		await saveSharedRef.current(toWrites(patch.variables));
		// The new names exist now: carry the caller's values over to them.
		const moves = renamesOf(patch.variables).flatMap(({ from, to }) => {
			const value = localRef.current.get(from);
			return value === undefined || localRef.current.has(to)
				? []
				: [
						{ key: from, value: null },
						{ key: to, value },
					];
		});
		if (moves.length > 0) await saveLocalRef.current(moves);
	});
	const local = usePageAutosave<LocalPatch>(async (patch) => {
		const values = Object.entries(patch).map(([key, value]) => ({
			key,
			value: value ?? null,
		}));
		if (values.length > 0) await saveLocalRef.current(values);
	});

	const [drafts, setDrafts] = useState(() => draftsOf(variables));
	const sharedPending = shared.pending.variables !== undefined;
	// Fresh server data (a save's answer, a refetch) while nothing waits.
	useEffect(() => {
		if (!sharedPending) setDrafts((current) => mergeDrafts(current, variables));
	}, [variables, sharedPending]);

	const draftsRef = useRef(drafts);
	draftsRef.current = drafts;
	const nextRow = useRef(0);
	const localMap = useMemo(
		() => mergedLocal(localValues, local.pending),
		[localValues, local.pending],
	);
	localRef.current = localMap;
	const duplicates = useMemo(() => duplicateNames(drafts), [drafts]);

	const commit = useCallback(
		(next: DraftVariable[]) => {
			setDrafts(next);
			// A duplicate name cannot be saved; it waits until it is fixed.
			if (duplicateNames(next).size === 0) shared.edit({ variables: next });
		},
		[shared.edit],
	);

	const editLocal = useCallback(
		(key: string, value: string | null) => {
			if (key.trim() !== "") local.edit({ [key]: value });
		},
		[local.edit],
	);

	const editVariable = useCallback(
		(rowId: string, change: Partial<DraftVariable>) =>
			commit(
				draftsRef.current.map((v) =>
					v.rowId === rowId ? { ...v, ...change } : v,
				),
			),
		[commit],
	);

	/** A blank row to type into; nothing is saved until it has a name. */
	const addVariable = useCallback((): string => {
		nextRow.current += 1;
		const rowId = `new-${nextRow.current}`;
		setDrafts((current) => [...current, blankDraft(rowId)]);
		return rowId;
	}, []);

	const removeVariable = useCallback(
		(rowId: string) =>
			commit(draftsRef.current.filter((v) => v.rowId !== rowId)),
		[commit],
	);

	/** Share value / Update shared value: the local value becomes shared. */
	const share = useCallback(
		(row: VariableRow) => {
			const value = row.local ?? "";
			if (row.localOnly) {
				nextRow.current += 1;
				const added = {
					...blankDraft(`new-${nextRow.current}`),
					key: row.variable.key,
					sharedValue: value,
				};
				commit([...draftsRef.current, added]);
			} else {
				editVariable(row.variable.rowId, { sharedValue: value });
			}
			editLocal(row.localKey, null);
		},
		[commit, editVariable, editLocal],
	);

	const unshare = useCallback(
		(row: VariableRow) =>
			editVariable(row.variable.rowId, { sharedValue: null }),
		[editVariable],
	);

	const flush = useCallback(async () => {
		await Promise.all([shared.flush(), local.flush()]);
	}, [shared.flush, local.flush]);

	return {
		rows: rowsOf(drafts, localMap),
		duplicates,
		canEdit,
		editVariable,
		addVariable,
		removeVariable,
		editLocal,
		share,
		unshare,
		flush,
		status: combinedStatus(shared.status, local.status),
	};
}

export type VariableEditor = ReturnType<typeof useVariableEditor>;
