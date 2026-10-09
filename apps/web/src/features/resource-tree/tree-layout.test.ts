import { describe, expect, it } from "vitest";
import { SAMPLE_TREE } from "./tree-fixtures";
import { TREE_GEOMETRY, elbowPath, layoutTree, orderTree } from "./tree-layout";

const g = TREE_GEOMETRY;

describe("orderTree", () => {
	it("walks parents before children and keeps sibling order", () => {
		expect(
			orderTree(SAMPLE_TREE).map(({ item, depth }) => [item.id, depth]),
		).toEqual([
			["users", 0],
			["posts", 1],
			["comments", 2],
			["likes", 0],
		]);
	});

	it("puts children listed before their parent under it", () => {
		const shuffled = [
			SAMPLE_TREE[2],
			SAMPLE_TREE[3],
			SAMPLE_TREE[1],
			SAMPLE_TREE[0],
		].filter((item) => item !== undefined);
		expect(orderTree(shuffled).map(({ item }) => item.id)).toEqual([
			"likes",
			"users",
			"posts",
			"comments",
		]);
	});

	it("treats a resource with a missing parent as a root", () => {
		const items = [{ id: "a", parentId: "gone", name: "a" }];
		expect(orderTree(items)).toEqual([{ item: items[0], depth: 0 }]);
	});
});

describe("layoutTree", () => {
	const layout = layoutTree(SAMPLE_TREE);

	it("places one row per resource and one column per depth", () => {
		expect(layout.nodes.map(({ item, x, y }) => [item.id, x, y])).toEqual([
			["users", g.originX, g.originY],
			["posts", g.originX + g.column, g.originY + g.row],
			["comments", g.originX + 2 * g.column, g.originY + 2 * g.row],
			["likes", g.originX, g.originY + 3 * g.row],
		]);
	});

	it("sizes the canvas to the deepest column and the last row", () => {
		expect(layout.width).toBe(
			g.originX + 2 * g.column + g.nodeWidth + g.trailing,
		);
		expect(layout.height).toBe(g.originY * 2 + 3 * g.row + g.nodeHeight);
	});

	it("links roots to the rail and children to their parent's right edge", () => {
		const users = layout.links.find((link) => link.childId === "users");
		expect(users).toMatchObject({ parentId: null });
		expect(users?.path).toBe(
			`M${g.railWidth} ${g.originY + g.handleY}H${g.originX}`,
		);
		const posts = layout.links.find((link) => link.childId === "posts");
		expect(posts?.parentId).toBe("users");
		expect(posts?.path.startsWith(`M${g.originX + g.nodeWidth} `)).toBe(true);
		expect(posts?.path).toContain("Q");
		expect(layout.links).toHaveLength(4);
	});

	it("puts an in and an out connector on each node", () => {
		const forLikes = layout.connectors.filter((c) => c.nodeId === "likes");
		const y = g.originY + 3 * g.row + g.handleY;
		expect(forLikes).toEqual([
			{ nodeId: "likes", side: "in", at: { x: g.originX, y } },
			{ nodeId: "likes", side: "out", at: { x: g.originX + g.nodeWidth, y } },
		]);
	});

	it("is empty for an empty project", () => {
		expect(layoutTree([])).toEqual({
			nodes: [],
			links: [],
			connectors: [],
			width: 0,
			height: 0,
		});
	});
});

describe("elbowPath", () => {
	it("draws a straight line between points on the same row", () => {
		expect(elbowPath({ x: 0, y: 5 }, { x: 40, y: 5 })).toBe("M0 5H40");
	});

	it("caps the corner radius at half the vertical distance", () => {
		expect(elbowPath({ x: 0, y: 0 }, { x: 100, y: 8 })).toBe(
			"M0 0H46Q50 0 50 4V4Q50 8 54 8H100",
		);
	});

	it("bends upwards when the target is higher", () => {
		expect(elbowPath({ x: 0, y: 100 }, { x: 100, y: 0 })).toBe(
			"M0 100H40Q50 100 50 90V10Q50 0 60 0H100",
		);
	});
});
