/**
 * Saving a request tab (Ctrl/Cmd+S or Save): a tab bound to a collection
 * request writes its draft (and name) to that node and turns clean; a
 * node that is gone unbinds the tab, which keeps its edits. A loose tab
 * asks where to save it (`SaveToCollectionModal`).
 */
import type {
	CollectionDetail,
	CollectionNode,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { collectionErrorMessage } from "./collection-errors";
import { updateNode } from "./collections-api";
import { COLLECTIONS_KEY, collectionKey } from "./use-collections";

/** The cached collection with `node` in place of its older self. */
export function withNode(
	detail: CollectionDetail | undefined,
	node: CollectionNode,
): CollectionDetail | undefined {
	if (!detail) return detail;
	return {
		...detail,
		nodes: detail.nodes.map((item) => (item.id === node.id ? node : item)),
	};
}

export type SaveRequest = (tab: WorkbenchTab) => Promise<void>;

/** `askWhere` opens the save dialog for a loose tab. */
export function useRequestSave(askWhere: (tabId: string) => void): SaveRequest {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { setSaved, bindTab, saveDrafts } = useWorkbenchActions();
	// One save per tab at a time: a second press waits for nothing and
	// cannot mark an older draft saved after a newer one.
	const saving = useRef(new Set<string>());
	return useCallback(
		async (tab: WorkbenchTab) => {
			if (!tab.source) {
				askWhere(tab.id);
				return;
			}
			if (saving.current.has(tab.id)) return;
			saving.current.add(tab.id);
			const { collectionId, nodeId } = tab.source;
			const { draft } = tab;
			// The node's name changes only when the tab renamed the request; a
			// tab that did not keeps a rename made meanwhile in the sidebar.
			const name = draft.name.trim();
			const renamed = name !== "" && draft.name !== tab.saved?.name;
			try {
				const node = await updateNode(
					collectionId,
					nodeId,
					renamed ? { draft, name } : { draft },
				);
				setSaved(tab.id, draft);
				client.setQueryData<CollectionDetail>(
					collectionKey(collectionId),
					(detail) => withNode(detail, node),
				);
				void client.invalidateQueries({
					queryKey: [...COLLECTIONS_KEY, "list"],
				});
				saveDrafts();
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) {
					bindTab(tab.id, null, null);
					toast.show({
						tone: "info",
						title: t("collections.save.goneTitle"),
						description: t("collections.save.gone"),
					});
					return;
				}
				toast.show({ tone: "error", title: collectionErrorMessage(error, t) });
			} finally {
				saving.current.delete(tab.id);
			}
		},
		[askWhere, setSaved, bindTab, saveDrafts, client, toast, t],
	);
}
