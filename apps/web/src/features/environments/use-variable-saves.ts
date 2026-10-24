/**
 * The two autosaves of a variable table, in order: shared variables
 * (Editors), then the caller's local values. After a shared save, the
 * local writes it implies go: a renamed variable's value moves, values
 * just shared go back to shared.
 */
import { type RefObject, useRef } from "react";
import { usePageAutosave } from "../collections/use-page-autosave";
import { secretNames } from "../secure-vault/vault-codec";
import type { VariableWrite } from "./environments-api";
import type { LocalValueWrite } from "./local-values-api";
import { localWritesAfterSave } from "./variable-batch";
import { type DraftVariable, toWrites } from "./variable-rows";

type SharedPatch = { variables: DraftVariable[] };
type LocalPatch = Record<string, string | null>;

export interface VariableSaveOptions {
	saveShared: (writes: VariableWrite[]) => Promise<void>;
	saveLocal: (
		values: LocalValueWrite[],
		secretKeys: ReadonlySet<string>,
	) => Promise<void>;
}

export interface VariableSaveRefs {
	/** The caller's readable local values (none locked in the vault). */
	local: RefObject<ReadonlyMap<string, string>>;
	/** Names whose local value is locked in the vault. */
	locked: RefObject<ReadonlyMap<string, boolean>>;
	/** The drafts as typed (their secret names seal local values too). */
	drafts: RefObject<DraftVariable[]>;
	/**
	 * Local values shared but not reset yet: they go only once the shared
	 * save succeeds, so a failed save never loses them.
	 */
	resets: RefObject<Set<string>>;
}

export function useVariableSaves(
	options: VariableSaveOptions,
	refs: VariableSaveRefs,
) {
	const saveSharedRef = useRef(options.saveShared);
	saveSharedRef.current = options.saveShared;
	const saveLocalRef = useRef(options.saveLocal);
	saveLocalRef.current = options.saveLocal;
	const flushLocalRef = useRef(async (): Promise<void> => {});
	const saveLocal = (values: LocalValueWrite[]) =>
		saveLocalRef.current(values, secretNames(refs.drafts.current));

	const shared = usePageAutosave<SharedPatch>(async (patch) => {
		if (!patch.variables) return;
		// The keys shared by the variables this save sends.
		const sent = [...refs.resets.current];
		await saveSharedRef.current(toWrites(patch.variables));
		// Typed local values go first, so the resets below come last.
		await flushLocalRef.current();
		const resets = sent.filter((key) => refs.resets.current.has(key));
		const writes = localWritesAfterSave(
			patch.variables,
			refs.local.current,
			resets,
			refs.locked.current,
		);
		if (writes.length > 0) await saveLocal(writes);
		for (const key of resets) refs.resets.current.delete(key);
	});
	const local = usePageAutosave<LocalPatch>(async (patch) => {
		const values = Object.entries(patch).map(([key, value]) => ({
			key,
			value: value ?? null,
		}));
		if (values.length > 0) await saveLocal(values);
	});
	flushLocalRef.current = local.flush;
	return { shared, local };
}
