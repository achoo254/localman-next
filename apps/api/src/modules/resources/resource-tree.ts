import { MAX_RESOURCE_DEPTH } from "@localman/shared";

/** What tree checks need of a resource. */
export interface TreeNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
}

export interface TreeEntry<T extends TreeNode> {
	readonly node: T;
	/** 0 for a root. */
	readonly depth: number;
}

function childrenByParent<T extends TreeNode>(
	nodes: readonly T[],
): Map<string | null, T[]> {
	const byParent = new Map<string | null, T[]>();
	for (const node of nodes) {
		const siblings = byParent.get(node.parentId) ?? [];
		siblings.push(node);
		byParent.set(node.parentId, siblings);
	}
	return byParent;
}

/**
 * Pre-order walk (parents before children, siblings in input order).
 * Nodes that no root reaches (a cycle or a missing parent, which writes
 * never produce) are appended as roots so they stay visible and editable.
 */
export function orderTree<T extends TreeNode>(
	nodes: readonly T[],
): TreeEntry<T>[] {
	const byParent = childrenByParent(nodes);
	const ordered: TreeEntry<T>[] = [];
	const seen = new Set<string>();
	const walk = (node: T, depth: number): void => {
		if (seen.has(node.id)) return;
		seen.add(node.id);
		ordered.push({ node, depth });
		for (const child of byParent.get(node.id) ?? []) walk(child, depth + 1);
	};
	for (const root of byParent.get(null) ?? []) walk(root, 0);
	for (const node of nodes) {
		if (!seen.has(node.id)) walk(node, 0);
	}
	return ordered;
}

/** Ids of every descendant of `id` (not `id` itself), cycle-safe. */
export function descendantIds(
	nodes: readonly TreeNode[],
	id: string,
): string[] {
	const byParent = childrenByParent(nodes);
	const found: string[] = [];
	const seen = new Set<string>([id]);
	const queue = [id];
	for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
		for (const child of byParent.get(next) ?? []) {
			if (seen.has(child.id)) continue;
			seen.add(child.id);
			found.push(child.id);
			queue.push(child.id);
		}
	}
	return found;
}

/** Levels from the root down to `id` (a root is level 1), cycle-safe. */
export function levelOf(nodes: readonly TreeNode[], id: string): number {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const seen = new Set<string>();
	let level = 0;
	for (let node = byId.get(id); node; ) {
		if (seen.has(node.id)) break;
		seen.add(node.id);
		level += 1;
		node = node.parentId === null ? undefined : byId.get(node.parentId);
	}
	return level;
}

/** Levels of the subtree rooted at `id`, itself included. */
function subtreeHeight(nodes: readonly TreeNode[], id: string): number {
	const byParent = childrenByParent(nodes);
	const seen = new Set<string>();
	const height = (nodeId: string): number => {
		if (seen.has(nodeId)) return 0;
		seen.add(nodeId);
		const children = byParent.get(nodeId) ?? [];
		return 1 + Math.max(0, ...children.map((child) => height(child.id)));
	};
	return height(id);
}

export type AttachProblemCode =
	| "PARENT_NOT_FOUND"
	| "SELF_PARENT"
	| "CYCLE"
	| "DUPLICATE_NAME"
	| "TOO_DEEP";

export interface AttachProblem {
	readonly code: AttachProblemCode;
	readonly message: string;
}

/**
 * Why `name` (a new resource, or the existing `id` being renamed or moved)
 * cannot sit under `parentId`; `null` when it can. Refuses a missing
 * parent, the resource itself or one of its descendants as parent (a
 * cycle), a sibling with the same name, and trees deeper than
 * `MAX_RESOURCE_DEPTH` levels.
 */
export function attachProblem(
	nodes: readonly TreeNode[],
	target: {
		readonly id?: string;
		readonly parentId: string | null;
		readonly name: string;
	},
): AttachProblem | null {
	const { id, parentId, name } = target;
	if (parentId !== null && !nodes.some((node) => node.id === parentId)) {
		return { code: "PARENT_NOT_FOUND", message: "Parent resource not found" };
	}
	if (id !== undefined && parentId === id) {
		return {
			code: "SELF_PARENT",
			message: "A resource cannot be its own parent",
		};
	}
	if (
		id !== undefined &&
		parentId !== null &&
		descendantIds(nodes, id).includes(parentId)
	) {
		return {
			code: "CYCLE",
			message: "A resource cannot be nested under its own descendant",
		};
	}
	const clash = nodes.some(
		(node) =>
			node.id !== id && node.parentId === parentId && node.name === name,
	);
	if (clash) {
		return {
			code: "DUPLICATE_NAME",
			message: `A sibling resource is already named "${name}"`,
		};
	}
	const above = parentId === null ? 0 : levelOf(nodes, parentId);
	const height = id === undefined ? 1 : subtreeHeight(nodes, id);
	if (above + height > MAX_RESOURCE_DEPTH) {
		return {
			code: "TOO_DEEP",
			message: `Resources nest at most ${MAX_RESOURCE_DEPTH} levels deep`,
		};
	}
	return null;
}
