/**
 * Pure keyboard model of the resource tree (WAI-ARIA tree view). Works on
 * the depths of the laid-out nodes in pre-order, so a parent is the last
 * node above with one level less and its first child is the node right
 * below with one level more. Every branch is always expanded.
 */

/** ARIA position of one node. */
export interface TreeItemMeta {
	/** `aria-level`, 1 for a root. */
	readonly level: number;
	readonly setSize: number;
	/** 1-based position among its siblings. */
	readonly posInSet: number;
	/** Index of the parent in the list, null for a root. */
	readonly parent: number | null;
	readonly hasChildren: boolean;
}

export type TreeNavKey =
	| "ArrowDown"
	| "ArrowUp"
	| "ArrowLeft"
	| "ArrowRight"
	| "Home"
	| "End";

const NAV_KEYS: ReadonlySet<string> = new Set<TreeNavKey>([
	"ArrowDown",
	"ArrowUp",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
]);

export function isTreeNavKey(key: string): key is TreeNavKey {
	return NAV_KEYS.has(key);
}

/** Level, siblings and parent of every node, from the pre-order depths. */
export function treeItemMeta(depths: readonly number[]): TreeItemMeta[] {
	const parents: Array<number | null> = [];
	// Last node seen at each depth: the parent of the next node one deeper.
	const lastAtDepth: number[] = [];
	depths.forEach((depth, index) => {
		parents.push(depth > 0 ? (lastAtDepth[depth - 1] ?? null) : null);
		lastAtDepth[depth] = index;
		lastAtDepth.length = depth + 1;
	});
	const siblings = new Map<number | null, number[]>();
	parents.forEach((parent, index) => {
		const list = siblings.get(parent) ?? [];
		list.push(index);
		siblings.set(parent, list);
	});
	return depths.map((depth, index) => {
		const parent = parents[index] ?? null;
		const group = siblings.get(parent) ?? [index];
		return {
			level: depth + 1,
			setSize: group.length,
			posInSet: group.indexOf(index) + 1,
			parent,
			hasChildren: depths[index + 1] === depth + 1,
		};
	});
}

/**
 * Index the focus moves to from `index`, or null when it stays: ↓/↑ the
 * next/previous node, → the first child, ← the parent, Home/End the
 * first/last node.
 */
export function treeNavTarget(
	meta: readonly TreeItemMeta[],
	index: number,
	key: TreeNavKey,
): number | null {
	const last = meta.length - 1;
	if (last < 0) return null;
	switch (key) {
		case "ArrowDown":
			return index < last ? index + 1 : null;
		case "ArrowUp":
			return index > 0 ? index - 1 : null;
		case "ArrowRight":
			return meta[index]?.hasChildren ? index + 1 : null;
		case "ArrowLeft":
			return meta[index]?.parent ?? null;
		case "Home":
			return index === 0 ? null : 0;
		case "End":
			return index === last ? null : last;
	}
}
