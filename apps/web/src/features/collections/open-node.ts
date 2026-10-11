/**
 * Opening an item of the collections tree (or a breadcrumb, or an
 * inherited-auth link): a request opens as a tab bound to its node (an
 * already open one is shown again), a collection or folder as its page.
 */
import {
	type ApiRequestDraft,
	type CollectionDetail,
	type CollectionRequestNode,
	DRAFT_MAX_TABS,
	type TabSource,
} from "@localman/shared/api-client";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";

export type OpenNodeTarget =
	| { kind: "collection"; collectionId: string; name: string }
	| { kind: "folder"; collectionId: string; nodeId: string; name: string }
	| {
			kind: "request";
			collection: CollectionDetail;
			node: CollectionRequestNode;
	  };

export type OpenNode = (target: OpenNodeTarget) => void;

/** The request as its tab edits it: the node's draft under the node's name. */
export function boundDraft(node: CollectionRequestNode): ApiRequestDraft {
	return { ...node.draft, name: node.name };
}

/** Tab id of a collection or folder page (never a UUID, unlike requests). */
export function pageId(kind: PageTab["kind"], id: string): string {
	return `${kind}-${id}`;
}

export function sameSource(a: TabSource | null, b: TabSource): boolean {
	return a?.collectionId === b.collectionId && a.nodeId === b.nodeId;
}

export function useOpenCollectionNode(): OpenNode {
	const t = useT();
	const toast = useToast();
	const { openTab, openPage, activateTab, currentTabs } = useWorkbenchActions();
	return useCallback(
		(target: OpenNodeTarget) => {
			if (target.kind === "collection" || target.kind === "folder") {
				const nodeId = target.kind === "folder" ? target.nodeId : null;
				openPage({
					id: pageId(target.kind, nodeId ?? target.collectionId),
					kind: target.kind,
					collectionId: target.collectionId,
					nodeId,
					name: target.name,
				});
				return;
			}
			const source = {
				collectionId: target.collection.id,
				nodeId: target.node.id,
			};
			const open = currentTabs().find((tab) => sameSource(tab.source, source));
			if (open) {
				activateTab(open.id);
				return;
			}
			const draft = boundDraft(target.node);
			if (openTab(draft, { source, saved: draft }) !== null) return;
			toast.show({
				tone: "error",
				title: t("apiClientOpen.toast.full"),
				description: t("apiClientOpen.toast.fullBody", { max: DRAFT_MAX_TABS }),
			});
		},
		[openTab, openPage, activateTab, currentTabs, toast, t],
	);
}
