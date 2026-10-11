import {
	COLLECTION_NAME_MAX,
	type CollectionDetail,
	type CollectionNode,
} from "@localman/shared/api-client";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { insertAndLoad } from "./collection-service.js";
import { loadCollectionDetail, newNodeId } from "./collection-store.js";

const COPY_SUFFIX = " Copy";

/** "<name> Copy", cut so it stays within the name limit. */
export function copyName(name: string): string {
	return `${name.slice(0, COLLECTION_NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

/**
 * Copies a collection the caller can view into a workspace where they add
 * elements (its own by default), with new node ids.
 */
export async function duplicateCollection(
	sub: string,
	id: string,
	targetWorkspaceId: string | undefined,
): Promise<CollectionDetail> {
	const { element, collectionId, role } = await requireCollection(
		sub,
		id,
		"view",
	);
	const { workspace } = await requireWorkspace(
		sub,
		"addElements",
		targetWorkspaceId ?? element.workspaceId.toHexString(),
	);
	const source = await loadCollectionDetail(collectionId, role);
	const ids = new Map(source.nodes.map((node) => [node.id, newNodeId()]));
	const nodes = source.nodes.flatMap((node): CollectionNode[] => {
		const id = ids.get(node.id) ?? newNodeId();
		if (node.kind === "example") {
			const parentId = ids.get(node.parentId);
			return parentId ? [{ ...node, id, parentId }] : [];
		}
		const parentId = node.parentId === null ? null : ids.get(node.parentId);
		return [{ ...node, id, parentId: parentId ?? null }];
	});
	const { name, description, auth, scripts, variables, tags, status } = source;
	return insertAndLoad({
		workspaceId: workspace._id,
		root: {
			name: copyName(name),
			description,
			auth,
			scripts,
			variables,
			tags,
			status,
		},
		nodes,
		sub,
	});
}
