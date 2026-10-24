/**
 * Editing of an environment's or the globals' variables: Editors change
 * definitions and shared values, everyone their own local values. Both
 * autosave in order (`usePageAutosave`). Server data is merged into the
 * drafts (`mergeDrafts`); a rename moves the local value once saved.
 */
import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isOpenVaultValue } from "../secure-vault/vault-codec";
import { combinedStatus } from "./combined-status";
import { lockedKeysOf, mergedLocal } from "./local-value-map";
import {
	type VariableSaveOptions,
	useVariableSaves,
} from "./use-variable-saves";
import { resetPatch, sharedDrafts, unsharedDrafts } from "./variable-batch";
import { mergeDrafts } from "./variable-drafts-merge";
import {
	type DraftVariable,
	type VariableRow,
	blankDraft,
	draftsOf,
	duplicateNames,
	rowsOf,
} from "./variable-rows";

export interface VariableEditorOptions extends VariableSaveOptions {
	variables: readonly VariableView[];
	localValues: readonly LocalValue[];
	canEdit: boolean;
}

export function useVariableEditor(options: VariableEditorOptions) {
	const { variables, localValues, canEdit } = options;
	const localRef = useRef<ReadonlyMap<string, string>>(new Map());
	const draftsRef = useRef<DraftVariable[]>([]);
	const lockedRef = useRef<ReadonlyMap<string, boolean>>(new Map());
	const resetsRef = useRef(new Set<string>());
	const { shared, local } = useVariableSaves(options, {
		local: localRef,
		locked: lockedRef,
		drafts: draftsRef,
		resets: resetsRef,
	});

	const [drafts, setDrafts] = useState(() => draftsOf(variables));
	const sharedPending = shared.pending.variables !== undefined;
	// Fresh server data (a save's answer, a refetch) while nothing waits.
	useEffect(() => {
		if (!sharedPending) setDrafts((current) => mergeDrafts(current, variables));
	}, [variables, sharedPending]);

	draftsRef.current = drafts;
	const nextRow = useRef(0);
	const localMap = useMemo(
		() => mergedLocal(localValues, local.pending),
		[localValues, local.pending],
	);
	localRef.current = localMap;
	// Values locked in the vault read as empty; their rows say so.
	const locked = lockedKeysOf(localValues, local.pending);
	lockedRef.current = locked;
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
			commit(sharedDrafts(draftsRef.current, rows, newRowId, isOpenVaultValue));
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
		rows: rowsOf(drafts, localMap, locked),
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
