import type { CollectionDetail } from "@localman/shared/api-client";
import { useCallback } from "react";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import { boundDraft } from "./open-node";

/**
 * After the collection changed underneath (restore to a change): open
 * request tabs bound to it take the stored request; a tab with unsaved
 * edits keeps them and only learns the new saved state.
 */
export function useRefreshBoundTabs(): (detail: CollectionDetail) => void {
	const { currentTabs, updateDraft, setSaved } = useWorkbenchActions();
	return useCallback(
		(detail: CollectionDetail) => {
			for (const tab of currentTabs()) {
				if (tab.source?.collectionId !== detail.id) continue;
				const node = detail.nodes.find(
					(item) => item.id === tab.source?.nodeId,
				);
				if (node?.kind !== "request") continue;
				const saved = boundDraft(node);
				if (!tab.dirty) updateDraft(tab.id, () => saved);
				setSaved(tab.id, saved);
			}
		},
		[currentTabs, updateDraft, setSaved],
	);
}
