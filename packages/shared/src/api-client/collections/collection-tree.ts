/**
 * Converts a stored collection (root plus flat nodes) to the nested
 * `CollectionTree` that import and export use, and back. Export reads the
 * tree; creating a collection from an import or a template writes the
 * nodes.
 */
import type {
	CollectionTree,
	ImportedItem,
} from "../import/imported-collection.js";
import type {
	CollectionDetail,
	CollectionFolderNode,
	CollectionNode,
} from "./collection-model.js";
import { compareOrder, orderKeysBetween } from "./collection-order.js";

/**
 * Deepest folder nesting (a top-level folder is at depth 1). Far beyond
 * what anyone builds by hand; it keeps recursive validation and export
 * well inside the call stack.
 */
export const COLLECTION_DEPTH_MAX = 64;

/** The root fields of a collection, as stored next to its nodes. */
export type CollectionRootFields = Pick<
	CollectionDetail,
	"name" | "description" | "auth" | "scripts" | "variables"
>;

/** Children of each parent (`null` for the top), sorted by order. */
export function childrenByParent(
	nodes: readonly CollectionNode[],
): Map<string | null, CollectionNode[]> {
	const byParent = new Map<string | null, CollectionNode[]>();
	for (const node of nodes) {
		const siblings = byParent.get(node.parentId);
		if (siblings) siblings.push(node);
		else byParent.set(node.parentId, [node]);
	}
	for (const siblings of byParent.values()) siblings.sort(compareOrder);
	return byParent;
}

/**
 * The collection as a nested tree, siblings in order. Nodes whose parent
 * is missing are left out (they cannot be reached from the top).
 */
export function nodesToCollectionTree(
	detail: CollectionDetail,
): CollectionTree {
	const byParent = childrenByParent(detail.nodes);
	const itemsOf = (parentId: string | null): ImportedItem[] =>
		(byParent.get(parentId) ?? []).map((node): ImportedItem => {
			if (node.kind === "request") {
				const { id, name, description, draft } = node;
				return { kind: "request", id, name, description, draft };
			}
			const { id, name, description, auth, scripts } = node;
			const items = itemsOf(id);
			return { kind: "folder", id, name, description, auth, scripts, items };
		});
	return {
		name: detail.name,
		description: detail.description,
		auth: detail.auth,
		variables: detail.variables,
		scripts: detail.scripts,
		items: itemsOf(null),
	};
}

/**
 * The root fields and flat nodes of a new collection built from `tree`.
 * Every node gets a fresh id from `idFactory` (tree item ids are only
 * unique within one import); siblings get ascending order keys.
 */
export function collectionTreeToNodes(
	tree: CollectionTree,
	idFactory: () => string,
): { root: CollectionRootFields; nodes: CollectionNode[] } {
	const nodes: CollectionNode[] = [];
	const addItems = (
		items: readonly ImportedItem[],
		parentId: string | null,
	) => {
		const keys = orderKeysBetween(null, null, items.length);
		items.forEach((item, index) => {
			const id = idFactory();
			const order = keys[index];
			if (order === undefined) throw new Error("Missing an order key");
			const { name, description } = item;
			if (item.kind === "request") {
				const { draft } = item;
				nodes.push({
					kind: "request",
					id,
					parentId,
					order,
					name,
					description,
					draft,
				});
				return;
			}
			const folder: CollectionFolderNode = {
				kind: "folder",
				id,
				parentId,
				order,
				name,
				description,
				auth: item.auth,
				scripts: item.scripts,
			};
			nodes.push(folder);
			addItems(item.items, id);
		});
	};
	addItems(tree.items, null);
	const { name, description, auth, scripts, variables } = tree;
	return { root: { name, description, auth, scripts, variables }, nodes };
}
