import {
	COLLECTION_NAME_MAX,
	type CollectionDetail,
	type CollectionNode,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { insertAndLoad } from "./collection-service.js";
import {
	findLiveCollection,
	loadCollectionDetail,
	newNodeId,
} from "./collection-store.js";

const COPY_SUFFIX = " Copy";

/** "<name> Copy", cut so it stays within the name limit. */
export function copyName(name: string): string {
	return `${name.slice(0, COLLECTION_NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

/**
 * The nodes with fresh ids (parents follow), and old id to new id. An
 * example whose request is missing is dropped.
 */
export function withNewIds(source: readonly CollectionNode[]): {
	nodes: CollectionNode[];
	ids: Map<string, string>;
} {
	const ids = new Map(source.map((node) => [node.id, newNodeId()]));
	const nodes = source.flatMap((node): CollectionNode[] => {
		const id = ids.get(node.id) ?? newNodeId();
		if (node.kind === "example") {
			const parentId = ids.get(node.parentId);
			return parentId ? [{ ...node, id, parentId }] : [];
		}
		const parentId = node.parentId === null ? null : ids.get(node.parentId);
		return [{ ...node, id, parentId: parentId ?? null }];
	});
	return { nodes, ids };
}

/**
 * Copies a collection the caller can view into a workspace where they add
 * elements (its own by default), with new node ids. Its mock project comes
 * along when the caller can read it; its linked environment when the copy
 * stays in the same workspace.
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
	const [source, root] = await Promise.all([
		loadCollectionDetail(collectionId, role, sub),
		findLiveCollection(collectionId),
	]);
	// The environment an Editor chose stays valid in the same workspace only.
	const sameWorkspace = workspace._id.equals(element.workspaceId);
	const linked = root?.linkedEnvironmentId;
	const { nodes } = withNewIds(source.nodes);
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
		// Only a link the caller can read comes along (`mockProject` is null otherwise).
		...(source.mockProject
			? { mockProjectId: new Types.ObjectId(source.mockProject.id) }
			: {}),
		...(sameWorkspace && linked !== undefined
			? { linkedEnvironmentId: linked }
			: {}),
	});
}
