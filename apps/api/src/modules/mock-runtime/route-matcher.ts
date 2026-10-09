/** What routing needs of a resource. */
export interface RouteNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
}

/** One `/:res[/:id]` pair of a mock path. */
export interface RouteStep<T extends RouteNode> {
	readonly node: T;
	/** `null` only on the last step (a collection route). */
	readonly recordId: string | null;
}

/**
 * Resource a path may start with: a root of that name, else the only
 * resource of that name anywhere in the tree (the flat `/:child` route of
 * the source). Names are compared case-sensitively because siblings
 * `Side` and `side` may coexist; a name used by several nested
 * resources and no root is ambiguous and matches nothing.
 */
function startNode<T extends RouteNode>(
	nodes: readonly T[],
	name: string,
): T | null {
	const root = nodes.find(
		(node) => node.parentId === null && node.name === name,
	);
	if (root) return root;
	const named = nodes.filter((node) => node.name === name);
	return named.length === 1 ? (named[0] ?? null) : null;
}

/**
 * Splits path segments into `[res, id?, childRes, id?, …]` along the
 * resource tree, any depth: `/users/1/posts/2/comments` gives users#1 →
 * posts#2 → comments. Every step but the last has a record id. `null`
 * when a name does not continue the tree.
 */
export function matchRoute<T extends RouteNode>(
	nodes: readonly T[],
	segments: readonly string[],
): RouteStep<T>[] | null {
	const [first] = segments;
	if (first === undefined) return null;
	const steps: RouteStep<T>[] = [];
	let node = startNode(nodes, first);
	let index = 0;
	while (node !== null) {
		steps.push({ node, recordId: segments[index + 1] ?? null });
		const childName = segments[index + 2];
		if (childName === undefined) return steps;
		const parentId: string = node.id;
		node =
			nodes.find(
				(candidate) =>
					candidate.parentId === parentId && candidate.name === childName,
			) ?? null;
		index += 2;
	}
	return null;
}
