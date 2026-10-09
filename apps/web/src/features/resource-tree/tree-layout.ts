/**
 * Pure layout of the resource tree canvas: one row per resource in
 * pre-order (parents above their children), one column per depth, elbow
 * links from a parent's right connector to its child's left connector and
 * from the "Thêm vào root" rail to every root.
 */

/** What the layout needs of a resource. */
export interface TreeItem {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
}

/** Canvas geometry in CSS pixels (SVG user units). */
export interface TreeGeometry {
	readonly nodeWidth: number;
	readonly nodeHeight: number;
	/** Horizontal step between depths (node width plus the link gutter). */
	readonly column: number;
	/** Vertical step between rows. */
	readonly row: number;
	/** Left edge of a root node (leaves room for the rail and its links). */
	readonly originX: number;
	readonly originY: number;
	/** Height of the connectors, measured from a node's top edge. */
	readonly handleY: number;
	/** Width of the "Thêm vào root" rail at the left edge. */
	readonly railWidth: number;
	/** Empty space right of the deepest node. */
	readonly trailing: number;
}

/**
 * Geometry of the approved prototype (`TREE_GEOMETRY.app`): a 208×104 card
 * holds the name, the 106×25 generator bar and the action row.
 */
export const TREE_GEOMETRY: TreeGeometry = Object.freeze({
	nodeWidth: 208,
	nodeHeight: 104,
	column: 268,
	row: 128,
	originX: 72,
	originY: 24,
	handleY: 22,
	railWidth: 32,
	trailing: 24,
});

export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface LaidOutNode<T extends TreeItem> {
	readonly item: T;
	readonly depth: number;
	/** Top-left corner of the node card. */
	readonly x: number;
	readonly y: number;
}

export interface TreeLink {
	/** Id of the child end; `parentId` null for a link from the rail. */
	readonly childId: string;
	readonly parentId: string | null;
	readonly path: string;
}

export interface TreeConnector {
	readonly nodeId: string;
	/** `in` selects the node (left), `out` nests the selection into it (right). */
	readonly side: "in" | "out";
	readonly at: Point;
}

export interface TreeLayout<T extends TreeItem> {
	readonly nodes: readonly LaidOutNode<T>[];
	readonly links: readonly TreeLink[];
	readonly connectors: readonly TreeConnector[];
	readonly width: number;
	readonly height: number;
}

/**
 * SVG path of an elbow link: straight when level, otherwise across to the
 * middle, down or up with rounded corners (radius ≤ 10), then across.
 */
export function elbowPath(from: Point, to: Point): string {
	const { x: x1, y: y1 } = from;
	const { x: x2, y: y2 } = to;
	if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
	const mid = x1 + (x2 - x1) / 2;
	const radius = Math.min(10, Math.abs(y2 - y1) / 2, (x2 - x1) / 2);
	const sign = y2 > y1 ? 1 : -1;
	return (
		`M${x1} ${y1}H${mid - radius}` +
		`Q${mid} ${y1} ${mid} ${y1 + sign * radius}` +
		`V${y2 - sign * radius}` +
		`Q${mid} ${y2} ${mid + radius} ${y2}H${x2}`
	);
}

/**
 * Pre-order walk keeping the input order among siblings. A resource whose
 * parent is missing is treated as a root, so a stale list still renders.
 */
export function orderTree<T extends TreeItem>(
	items: readonly T[],
): Array<{ item: T; depth: number }> {
	const ids = new Set(items.map((item) => item.id));
	const children = new Map<string | null, T[]>();
	for (const item of items) {
		const parent =
			item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
		const list = children.get(parent) ?? [];
		list.push(item);
		children.set(parent, list);
	}
	const ordered: Array<{ item: T; depth: number }> = [];
	const visited = new Set<string>();
	const visit = (parent: string | null, depth: number) => {
		for (const item of children.get(parent) ?? []) {
			if (visited.has(item.id)) continue;
			visited.add(item.id);
			ordered.push({ item, depth });
			visit(item.id, depth + 1);
		}
	};
	visit(null, 0);
	return ordered;
}

export function layoutTree<T extends TreeItem>(
	items: readonly T[],
	geometry: TreeGeometry = TREE_GEOMETRY,
): TreeLayout<T> {
	const g = geometry;
	const nodes = orderTree(items).map(({ item, depth }, index) => ({
		item,
		depth,
		x: g.originX + depth * g.column,
		y: g.originY + index * g.row,
	}));
	if (nodes.length === 0) {
		return { nodes, links: [], connectors: [], width: 0, height: 0 };
	}
	const byId = new Map(nodes.map((node) => [node.item.id, node]));
	const links = nodes.map((node): TreeLink => {
		const to = { x: node.x, y: node.y + g.handleY };
		const parent =
			node.item.parentId === null ? undefined : byId.get(node.item.parentId);
		const from = parent
			? { x: parent.x + g.nodeWidth, y: parent.y + g.handleY }
			: { x: g.railWidth, y: to.y };
		return {
			childId: node.item.id,
			parentId: parent ? parent.item.id : null,
			path: elbowPath(from, to),
		};
	});
	const connectors = nodes.flatMap((node): TreeConnector[] => [
		{
			nodeId: node.item.id,
			side: "in",
			at: { x: node.x, y: node.y + g.handleY },
		},
		{
			nodeId: node.item.id,
			side: "out",
			at: { x: node.x + g.nodeWidth, y: node.y + g.handleY },
		},
	]);
	const maxDepth = Math.max(...nodes.map((node) => node.depth));
	return {
		nodes,
		links,
		connectors,
		width: g.originX + maxDepth * g.column + g.nodeWidth + g.trailing,
		height: g.originY * 2 + (nodes.length - 1) * g.row + g.nodeHeight,
	};
}
