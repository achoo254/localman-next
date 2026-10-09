import { parentKeyOf } from "@localman/shared";

/** What path building needs of a resource. */
interface PathNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
}

/**
 * Names of the resources above `node`, outermost first. Stops at a
 * missing parent or a repeated id (writes never make cycles; this only
 * keeps a corrupt tree from looping).
 */
export function ancestorNames<T extends PathNode>(
	byId: ReadonlyMap<string, T>,
	node: T,
): string[] {
	const names: string[] = [];
	const seen = new Set([node.id]);
	let parent = node.parentId === null ? undefined : byId.get(node.parentId);
	while (parent && !seen.has(parent.id)) {
		seen.add(parent.id);
		names.unshift(parent.name);
		parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
	}
	return names;
}

export interface CollectionPath {
	/** `/users/{userId}/posts`, below the project's prefix. */
	readonly path: string;
	/** Path parameters naming the parent records, outermost first. */
	readonly params: readonly string[];
}

/**
 * The nested REST collection route of a resource (the one MCP tools
 * address with `parentId`). Parameters are named `{parent}Id` like the
 * records' parent field; a name repeated along the path gets a number.
 */
export function collectionPath(
	ancestors: readonly string[],
	name: string,
): CollectionPath {
	const params: string[] = [];
	const segments = ancestors.map((parent) => {
		const base = parentKeyOf(parent);
		let param = base;
		for (let n = 2; params.includes(param); n += 1) param = `${base}${n}`;
		params.push(param);
		return `/${parent}/{${param}}`;
	});
	return { path: `${segments.join("")}/${name}`, params };
}
