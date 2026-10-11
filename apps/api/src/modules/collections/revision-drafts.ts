import type {
	ChangelogAction,
	CollectionNode,
	CollectionRootFields,
} from "@localman/shared/api-client";
import type { StoredCollection } from "./collection-model.js";
import type { RevisionDraft, StateSlice } from "./revision-patch.js";

/** The root's content as revisions patch it. */
export function rootStateOf(root: StoredCollection): CollectionRootFields {
	const { name, description, auth, scripts, variables } = root;
	const tags = [...(root.tags ?? [])];
	return {
		name,
		description,
		auth,
		scripts,
		variables,
		tags,
		status: root.status ?? null,
	};
}

export function nodesSlice(nodes: readonly CollectionNode[]): StateSlice {
	return { nodes: Object.fromEntries(nodes.map((node) => [node.id, node])) };
}

/**
 * A change of nodes: `before` and `after` hold every node it touched (a
 * subtree for a deletion or a copy); `entity` names it in the changelog.
 */
export function nodesRevision(
	action: ChangelogAction,
	entity: CollectionNode,
	before: readonly CollectionNode[],
	after: readonly CollectionNode[],
): RevisionDraft {
	return {
		entity: "node",
		entityId: entity.id,
		entityKind: entity.kind,
		entityName: entity.name,
		action,
		before: nodesSlice(before),
		after: nodesSlice(after),
	};
}

/** A change of the root (`null` on a side: it is not part of the change). */
export function rootRevision(
	action: ChangelogAction,
	collectionId: string,
	name: string,
	before: CollectionRootFields | null,
	after: CollectionRootFields | null,
): RevisionDraft {
	const slice = (root: CollectionRootFields | null): StateSlice =>
		root ? { root, nodes: {} } : { nodes: {} };
	return {
		entity: "collection",
		entityId: collectionId,
		entityKind: "collection",
		entityName: name,
		action,
		before: slice(before),
		after: slice(after),
	};
}
