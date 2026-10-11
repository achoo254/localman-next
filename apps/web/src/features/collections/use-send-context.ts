/**
 * What a tab bound to a collection request inherits when it is sent: the
 * collection (read from the cache, or fetched) gives the auth an
 * `inherit` request uses, the scripts around the tab's own (collection,
 * folders outer to inner, then the tab's unsaved scripts) and the
 * collection variables.
 */
import {
	type CollectionDetail,
	requestContext,
} from "@localman/shared/api-client";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useT } from "../../i18n/i18n-context";
import type { SendContextOf } from "../api-client/workbench/use-send-tab";
import type { SendContext } from "../api-client/workbench/workbench-tab-types";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { collectionErrorMessage } from "./collection-errors";
import { fetchCollection } from "./collections-api";
import { collectionKey } from "./use-collections";

/** A cached collection younger than this is used as it is. */
const FRESH_MS = 15_000;

export function readCollection(
	client: QueryClient,
	collectionId: string,
): Promise<CollectionDetail> {
	return client.fetchQuery({
		queryKey: collectionKey(collectionId),
		queryFn: () => fetchCollection(collectionId),
		staleTime: FRESH_MS,
	});
}

/** The send context of `tab` within `detail`; `null` when the node is gone. */
export function sendContextOf(
	detail: CollectionDetail,
	tab: Pick<WorkbenchTab, "source" | "draft">,
): SendContext | null {
	if (!tab.source) return null;
	const context = requestContext(detail, tab.source.nodeId, tab.draft.scripts);
	if (!context) return null;
	const { inheritedAuth, preScripts, postScripts, variables } = context;
	return { inheritedAuth, preScripts, postScripts, variables };
}

/**
 * For `WorkbenchProvider`; `undefined` while the workspaces flag is off. A
 * collection that cannot be read (deleted, no access, offline) or a
 * request no longer in it stops the send with the reason.
 */
export function useCollectionSendContext(): SendContextOf | undefined {
	const enabled = useWorkspacesEnabled();
	const client = useQueryClient();
	const t = useT();
	return useMemo(() => {
		if (!enabled) return undefined;
		return async (tab: WorkbenchTab) => {
			const unavailable = (reason: string) => ({
				unavailable: t("collections.send.unavailable", { reason }),
			});
			if (!tab.source) return unavailable(t("collections.send.gone"));
			try {
				const detail = await readCollection(client, tab.source.collectionId);
				const context = sendContextOf(detail, tab);
				return context ? { context } : unavailable(t("collections.send.gone"));
			} catch (error) {
				return unavailable(collectionErrorMessage(error, t));
			}
		};
	}, [enabled, client, t]);
}
