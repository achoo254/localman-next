/**
 * A rename in the tree reaches the open tabs: the page of a collection or
 * folder takes the new label, and a request tab bound to the node takes
 * the new name when it had not renamed the request itself (so saving it
 * later does not put the old name back).
 */
import { useCallback } from "react";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import { pageId, sameSource } from "./open-node";
import type { TreeRow } from "./tree-rows";

export function useRenameSync(): (row: TreeRow, name: string) => void {
	const { currentTabs, updateDraft, setSaved, renamePage } =
		useWorkbenchActions();
	return useCallback(
		(row: TreeRow, name: string) => {
			if (row.kind !== "request") {
				renamePage(pageId(row.kind, row.id), name);
				return;
			}
			const source = { collectionId: row.collectionId, nodeId: row.id };
			for (const tab of currentTabs()) {
				const { saved } = tab;
				if (!sameSource(tab.source, source) || !saved) continue;
				if (tab.draft.name !== saved.name) continue;
				updateDraft(tab.id, (draft) =>
					draft.name === saved.name ? { ...draft, name } : draft,
				);
				setSaved(tab.id, { ...saved, name });
			}
		},
		[currentTabs, updateDraft, setSaved, renamePage],
	);
}
