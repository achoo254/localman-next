import { useEffect, useMemo } from "react";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";
import { boundDraft } from "./open-node";
import { useCollectionDetails } from "./use-collections";

/**
 * Tabs bound to a collection request but restored after a reload do not
 * know the request's saved draft yet: this reads their collections and
 * hands it over, so "unsaved" reflects real differences.
 */
export function BoundSavedSync() {
	const { tabs } = useWorkbenchState();
	const { setSaved } = useWorkbenchActions();
	const waiting = tabs.filter(
		(tab) => tab.source !== null && tab.saved === null,
	);
	const key = [...new Set(waiting.map((tab) => tab.source?.collectionId ?? ""))]
		.filter(Boolean)
		.sort()
		.join(",");
	const ids = useMemo(() => (key ? key.split(",") : []), [key]);
	const details = useCollectionDetails(ids);

	useEffect(() => {
		for (const tab of waiting) {
			const state = tab.source
				? details.get(tab.source.collectionId)
				: undefined;
			if (state?.status !== "ready") continue;
			const node = state.detail.nodes.find(
				(item) => item.id === tab.source?.nodeId,
			);
			if (node?.kind === "request") setSaved(tab.id, boundDraft(node));
		}
	}, [waiting, details, setSaved]);
	return null;
}
