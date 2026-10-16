import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { useWorkbenchState } from "../api-client/workbench/workbench-context";
import { type OpenNode, useOpenCollectionNode } from "../collections/open-node";
import { readCollection } from "../collections/use-send-context";
import { focusComment } from "../comments/comment-focus";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";
import { useOpenVariablesPage } from "../environments/use-open-variables-page";
import { focusPullRequest } from "../version-control/pull-request-focus";
import { type OpenElement, readOpenElement } from "./open-element-state";
import { fetchElement } from "./sharing-api";
import { elementKey } from "./use-element-access";

interface NodeOpening {
	client: QueryClient;
	openNode: OpenNode;
	notify: (title: string) => void;
	t: Translate;
}

/**
 * A folder or example as its page, a request as a tab bound to it (the
 * collection is loaded for that); one no longer there opens the
 * collection page, with a note.
 */
async function openCollectionNode(
	{ client, openNode, notify, t }: NodeOpening,
	collectionId: string,
	nodeId: string,
): Promise<boolean> {
	const collection = await readCollection(client, collectionId);
	const node = collection.nodes.find((item) => item.id === nodeId);
	if (!node) {
		openNode({ kind: "collection", collectionId, name: collection.name });
		notify(t("sharing.element.nodeGone", { name: collection.name }));
		return false;
	}
	if (node.kind === "request") {
		openNode({ kind: "request", collection, node });
		return true;
	}
	openNode({ kind: node.kind, collectionId, nodeId, name: node.name });
	return true;
}

/**
 * Opens the element an element link navigated here with, once: a
 * collection as its page (or one of its folders and requests), an
 * environment as its tab (environments flag on). Waits until the saved drafts are restored, then clears the state
 * with a `replace` navigation so a reload or going back does not open it
 * again. Its name comes from the element summary (cached by the link
 * page), never from history state.
 */
function useOpenElementFromNavigation(): void {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const location = useLocation();
	const navigate = useNavigate();
	const restoring = useWorkbenchState().syncStatus.state === "loading";
	const openNode = useOpenCollectionNode();
	const { openEnvironment } = useOpenVariablesPage();
	const environments = useEnvironmentsEnabled();
	// History entry already handled (effects may run twice in development).
	const handledKey = useRef<string | null>(null);

	useEffect(() => {
		if (restoring || handledKey.current === location.key) return;
		const target = readOpenElement(location.state);
		if (!target) return;
		handledKey.current = location.key;
		const { pathname, search, hash } = location;
		void navigate({ pathname, search, hash }, { replace: true, state: null });
		const notify = (title: string) => toast.show({ tone: "info", title });
		const open = async ({
			type,
			id,
			nodeId,
			commentId,
			pullRequestId,
		}: OpenElement): Promise<void> => {
			let name = id;
			try {
				const element = await client.fetchQuery({
					queryKey: elementKey(type, id),
					queryFn: () => fetchElement(type, id),
				});
				name = element.name;
				// The item that actually opened: the collection when it is gone.
				let opened: string | null = null;
				if (type === "collection" && nodeId !== undefined) {
					const opening = { client, openNode, notify, t };
					if (await openCollectionNode(opening, id, nodeId)) opened = nodeId;
				} else if (type === "collection") {
					openNode({ kind: "collection", collectionId: id, name });
				} else if (environments) {
					openEnvironment(id, name);
				}
				if (type === "collection" && pullRequestId !== undefined) {
					focusPullRequest({
						collectionId: id,
						pullRequestId,
						commentId: commentId ?? null,
					});
				} else if (type === "collection" && commentId !== undefined) {
					focusComment({ collectionId: id, nodeId: opened, commentId });
				}
			} catch {
				toast.show({
					tone: "error",
					title: t("sharing.element.openFailed", { name }),
				});
			}
		};
		void open(target);
	}, [
		restoring,
		location,
		navigate,
		client,
		openNode,
		openEnvironment,
		environments,
		toast,
		t,
	]);
}

function Listener() {
	useOpenElementFromNavigation();
	return null;
}

/** The workbench also renders without a router (unit tests of its panels). */
export function OpenElementFromNavigation() {
	return useInRouterContext() ? <Listener /> : null;
}
