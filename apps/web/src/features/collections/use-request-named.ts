/**
 * Finds a request of a collection by its name, for `{{response "<name>"
 * …}}` references: the first one in tree order when names repeat.
 */
import {
	type CollectionDetail,
	type CollectionRequestNode,
	childrenByParent,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RequestNamed } from "../api-client/workbench/send-hooks";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { boundDraft } from "./open-node";
import { readCollection } from "./use-send-context";

/** Requests of the collection in the order its tree shows them. */
export function requestsInOrder(
	detail: CollectionDetail,
): CollectionRequestNode[] {
	const byParent = childrenByParent(detail.nodes);
	const out: CollectionRequestNode[] = [];
	const walk = (parent: string | null) => {
		for (const node of byParent.get(parent) ?? []) {
			if (node.kind === "request") out.push(node);
			if (node.kind === "folder") walk(node.id);
		}
	};
	walk(null);
	return out;
}

/** For `WorkbenchProvider`; `undefined` while the workspaces flag is off. */
export function useRequestNamed(): RequestNamed | undefined {
	const enabled = useWorkspacesEnabled();
	const client = useQueryClient();
	return useMemo(() => {
		if (!enabled) return undefined;
		return async (collectionId: string, name: string) => {
			const detail = await readCollection(client, collectionId);
			const wanted = name.trim();
			const node = requestsInOrder(detail).find(
				(n) => n.name.trim() === wanted,
			);
			return node
				? { source: { collectionId, nodeId: node.id }, draft: boundDraft(node) }
				: null;
		};
	}, [enabled, client]);
}
