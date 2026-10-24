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
import { usePageAutosave } from "../collections/use-page-autosave";
import { combinedStatus } from "./combined-status";
import type { VariableWrite } from "./environments-api";
import type { LocalValueWrite } from "./local-values-api";
import {
	localWritesAfterSave,
	resetPatch,
	sharedDrafts,
	unsharedDrafts,
} from "./variable-batch";
import {
	type DraftVariable,
	type VariableRow,
	blankDraft,
	draftsOf,
	duplicateNames,
	mergeDrafts,
	mergedLocal,
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

export function useVariableEditor(options: VariableEditorOptions) {
	const { variables, localValues, canEdit } = options;
	const saveSharedRef = useRef(options.saveShared);
	saveSharedRef.current = options.saveShared;
	const saveLocalRef = useRef(options.saveLocal);
	saveLocalRef.current = options.saveLocal;
	const localRef = useRef(new Map<string, string>());

	// Local values shared but not reset yet: they go only once the shared
	// save succeeds, so a failed save never loses them.
	const resetsRef = useRef(new Set<string>());
	const flushLocalRef = useRef(async (): Promise<void> => {});

	const shared = usePageAutosave<SharedPatch>(async (patch) => {
		if (!patch.variables) return;
		// The keys shared by the variables this save sends.
		const sent = [...resetsRef.current];
		await saveSharedRef.current(toWrites(patch.variables));
		// Typed local values go first, so the resets below come last.
		await flushLocalRef.current();
		const resets = sent.filter((key) => resetsRef.current.has(key));
		const writes = localWritesAfterSave(
			patch.variables,
			localRef.current,
			resets,
		);
		if (writes.length > 0) await saveLocalRef.current(writes);
		for (const key of resets) resetsRef.current.delete(key);
	});
	const local = usePageAutosave<LocalPatch>(async (patch) => {
		const values = Object.entries(patch).map(([key, value]) => ({
			key,
			value: value ?? null,
		}));
		if (values.length > 0) await saveLocalRef.current(values);
	});
	flushLocalRef.current = local.flush;

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
			if (key.trim() === "") return;
			// A value typed after Share wins over its pending reset.
			resetsRef.current.delete(key);
			local.edit({ [key]: value });
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

	const newRowId = useCallback((): string => {
		nextRow.current += 1;
		return `new-${nextRow.current}`;
	}, []);

	/** A blank row to type into; nothing is saved until it has a name. */
	const addVariable = useCallback((): string => {
		const rowId = newRowId();
		setDrafts((current) => [...current, blankDraft(rowId)]);
		return rowId;
	}, [newRowId]);

	const removeVariable = useCallback(
		(rowId: string) =>
			commit(draftsRef.current.filter((v) => v.rowId !== rowId)),
		[commit],
	);

	/** Reset value of these rows: their local values go in one save. */
	const resetRows = useCallback(
		(rows: readonly VariableRow[]) => {
			const patch = resetPatch(rows);
			if (Object.keys(patch).length > 0) local.edit(patch);
		},
		[local.edit],
	);

	/**
	 * Share value / Update shared value of these rows (one or all): their
	 * local values become shared in one save; once it succeeds, they reset.
	 */
	const shareRows = useCallback(
		(rows: readonly VariableRow[]) => {
			if (rows.length === 0) return;
			for (const key of Object.keys(resetPatch(rows))) {
				resetsRef.current.add(key);
			}
			commit(sharedDrafts(draftsRef.current, rows, newRowId));
		},
		[commit, newRowId],
	);

	/** Unshare of these rows: their shared values go in one save. */
	const unshareRows = useCallback(
		(rows: readonly VariableRow[]) => {
			if (rows.length > 0) commit(unsharedDrafts(draftsRef.current, rows));
		},
		[commit],
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
		shareRows,
		unshareRows,
		resetRows,
		flush,
		status: combinedStatus(shared.status, local.status),
	};
}

export type VariableEditor = ReturnType<typeof useVariableEditor>;
