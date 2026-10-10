import { resourceParentKey } from "@localman/shared";

/** What path building needs of a resource. */
interface PathNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
	/** Stored Parent ID; absent on resources stored before keys were. */
	readonly parentKey?: string | null;
}

/**
 * The resources above `node`, outermost first. Stops at a missing parent
 * or a repeated id (writes never make cycles; this only keeps a corrupt
 * tree from looping).
 */
export function ancestorsOf<T extends PathNode>(
	byId: ReadonlyMap<string, T>,
	node: T,
): T[] {
	const ancestors: T[] = [];
	const seen = new Set([node.id]);
	let parent = node.parentId === null ? undefined : byId.get(node.parentId);
	while (parent && !seen.has(parent.id)) {
		seen.add(parent.id);
		ancestors.unshift(parent);
		parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
	}
	return ancestors;
}

export interface CollectionPath {
	/** `/users/{userId}/posts`, below the project's prefix. */
	readonly path: string;
	/** Path parameters naming the parent records, outermost first. */
	readonly params: readonly string[];
}

/**
 * The nested REST collection route of the last resource of `chain` (its
 * ancestors outermost first, then itself), the one MCP tools address with
 * `parentId`. Each parent's parameter is named like the Parent ID of the
 * resource below it (`resourceParentKey`); a name repeated along the path
 * gets a number.
 */
export function collectionPath(chain: readonly PathNode[]): CollectionPath {
	const params: string[] = [];
	const segments: string[] = [];
	let parent: PathNode | null = null;
	for (const node of chain) {
		if (parent !== null) {
			const base = resourceParentKey(node, parent.name);
			let param = base;
			for (let n = 2; params.includes(param); n += 1) param = `${base}${n}`;
			params.push(param);
			segments.push(`/${parent.name}/{${param}}`);
		}
		parent = node;
	}
	return { path: `${segments.join("")}/${parent?.name ?? ""}`, params };
}
