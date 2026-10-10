import { describe, expect, it } from "vitest";
import { isTreeNavKey, treeItemMeta, treeNavTarget } from "./tree-navigation";

// users → posts → comments, users → tags, likes (pre-order depths).
const DEPTHS = [0, 1, 2, 1, 0];
const META = treeItemMeta(DEPTHS);

describe("treeItemMeta", () => {
	it("gives level, siblings and parent from the pre-order depths", () => {
		expect(META).toEqual([
			{ level: 1, setSize: 2, posInSet: 1, parent: null, hasChildren: true },
			{ level: 2, setSize: 2, posInSet: 1, parent: 0, hasChildren: true },
			{ level: 3, setSize: 1, posInSet: 1, parent: 1, hasChildren: false },
			{ level: 2, setSize: 2, posInSet: 2, parent: 0, hasChildren: false },
			{ level: 1, setSize: 2, posInSet: 2, parent: null, hasChildren: false },
		]);
	});

	it("handles an empty tree and a flat list", () => {
		expect(treeItemMeta([])).toEqual([]);
		expect(treeItemMeta([0, 0, 0]).map((item) => item.posInSet)).toEqual([
			1, 2, 3,
		]);
	});
});

describe("treeNavTarget", () => {
	it("walks the nodes in tree order with ↓ and ↑", () => {
		expect(treeNavTarget(META, 0, "ArrowDown")).toBe(1);
		expect(treeNavTarget(META, 4, "ArrowDown")).toBeNull();
		expect(treeNavTarget(META, 3, "ArrowUp")).toBe(2);
		expect(treeNavTarget(META, 0, "ArrowUp")).toBeNull();
	});

	it("goes to the first child with → and to the parent with ←", () => {
		expect(treeNavTarget(META, 0, "ArrowRight")).toBe(1);
		expect(treeNavTarget(META, 2, "ArrowRight")).toBeNull();
		expect(treeNavTarget(META, 3, "ArrowLeft")).toBe(0);
		expect(treeNavTarget(META, 2, "ArrowLeft")).toBe(1);
		expect(treeNavTarget(META, 4, "ArrowLeft")).toBeNull();
	});

	it("jumps to the first and last node with Home and End", () => {
		expect(treeNavTarget(META, 2, "Home")).toBe(0);
		expect(treeNavTarget(META, 0, "Home")).toBeNull();
		expect(treeNavTarget(META, 1, "End")).toBe(4);
		expect(treeNavTarget(META, 4, "End")).toBeNull();
		expect(treeNavTarget([], 0, "End")).toBeNull();
	});

	it("knows which keys it handles", () => {
		expect(isTreeNavKey("ArrowDown")).toBe(true);
		expect(isTreeNavKey("Enter")).toBe(false);
		expect(isTreeNavKey("a")).toBe(false);
	});
});
