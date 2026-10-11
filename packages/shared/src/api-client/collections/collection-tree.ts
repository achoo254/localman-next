/**
 * Converts a stored collection (root plus flat nodes) to the nested
 * `CollectionTree` that import and export use, and back. Export reads the
 * tree; creating a collection from an import or a template writes the
 * nodes. Examples are nodes under their request node in storage and the
 * request's `examples` in the tree.
 */
import type {
	CollectionTree,
	ImportedExample,
	ImportedItem,
} from "../import/imported-collection.js";
import type {
	CollectionDetail,
	CollectionExampleNode,
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
	"name" | "description" | "auth" | "scripts" | "variables" | "tags" | "status"
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
	const examplesOf = (requestId: string): ImportedExample[] =>
		(byParent.get(requestId) ?? []).flatMap((node) =>
			node.kind === "example"
				? [
						{
							id: node.id,
							name: node.name,
							request: node.request,
							response: node.response,
						},
					]
				: [],
		);
	const itemsOf = (parentId: string | null): ImportedItem[] =>
		(byParent.get(parentId) ?? []).flatMap((node): ImportedItem[] => {
			if (node.kind === "example") return [];
			const { id, name, description } = node;
			if (node.kind === "request") {
				const examples = examplesOf(id);
				return [
					{
						kind: "request",
						id,
						name,
						description,
						draft: node.draft,
						examples,
					},
				];
			}
			const { auth, scripts } = node;
			const items = itemsOf(id);
			return [{ kind: "folder", id, name, description, auth, scripts, items }];
		});
	return {
		name: detail.name,
		description: detail.description,
		auth: detail.auth,
		variables: detail.variables,
		scripts: detail.scripts,
		tags: detail.tags,
		status: detail.status,
		items: itemsOf(null),
	};
}

function orderKeys(count: number): string[] {
	return count === 0 ? [] : orderKeysBetween(null, null, count);
}

/** Pairs each entry with its order key (the keys are as many). */
function withOrder<T>(entries: readonly T[]): [T, string][] {
	const keys = orderKeys(entries.length);
	return entries.map((entry, index) => {
		const order = keys[index];
		if (order === undefined) throw new Error("Missing an order key");
		return [entry, order];
	});
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
	const addExamples = (
		examples: readonly ImportedExample[],
		parentId: string,
	) => {
		for (const [example, order] of withOrder(examples)) {
			const { name, request, response } = example;
			const node: CollectionExampleNode = {
				kind: "example",
				id: idFactory(),
				parentId,
				order,
				name,
				request,
				response,
			};
			nodes.push(node);
		}
	};
	const addItems = (
		items: readonly ImportedItem[],
		parentId: string | null,
	) => {
		for (const [item, order] of withOrder(items)) {
			const id = idFactory();
			const { name, description } = item;
			if (item.kind === "request") {
				nodes.push({
					kind: "request",
					id,
					parentId,
					order,
					name,
					description,
					draft: item.draft,
				});
				addExamples(item.examples, id);
				continue;
			}
			const { auth, scripts } = item;
			nodes.push({
				kind: "folder",
				id,
				parentId,
				order,
				name,
				description,
				auth,
				scripts,
			});
			addItems(item.items, id);
		}
	};
	addItems(tree.items, null);
	const { name, description, auth, scripts, variables, tags, status } = tree;
	return {
		root: { name, description, auth, scripts, variables, tags, status },
		nodes,
	};
}
