import { describe, expect, it } from "vitest";
import { folder, request } from "./collections-test-utils";
import {
	applyMove,
	dropPositionAt,
	isInSubtree,
	planMove,
	subtreeIds,
} from "./tree-drop";

const NODES = [
	folder("f1", null, "a0"),
	request("r1", "f1", "a0"),
	request("r2", "f1", "a1"),
	folder("f2", "f1", "a2"),
	request("r3", "f2", "a0"),
	request("top", null, "a1"),
	folder("empty", null, "a2"),
];
const node = (nodeId: string, expanded = false) =>
	({ kind: "node", nodeId, expanded }) as const;

describe("dropPositionAt", () => {
	const rect = { top: 100, height: 40 };

	it("splits a request in halves and gives a folder a middle band", () => {
		expect(dropPositionAt("request", 105, rect)).toBe("before");
		expect(dropPositionAt("request", 125, rect)).toBe("after");
		expect(dropPositionAt("folder", 105, rect)).toBe("before");
		expect(dropPositionAt("folder", 120, rect)).toBe("inside");
		expect(dropPositionAt("folder", 135, rect)).toBe("after");
		expect(dropPositionAt("collection", 101, rect)).toBe("inside");
	});
});

describe("planMove", () => {
	it("drops between two siblings with their order keys", () => {
		expect(planMove(NODES, "top", node("r2"), "before")).toEqual({
			parentId: "f1",
			beforeOrder: "a0",
			afterOrder: "a1",
		});
		expect(planMove(NODES, "r1", node("r2"), "after")).toEqual({
			parentId: "f1",
			beforeOrder: "a1",
			afterOrder: "a2",
		});
	});

	it("drops inside a folder or the collection at the end", () => {
		expect(planMove(NODES, "r1", node("empty"), "inside")).toEqual({
			parentId: "empty",
			beforeOrder: null,
			afterOrder: null,
		});
		expect(planMove(NODES, "r3", { kind: "collection" }, "inside")).toEqual({
			parentId: null,
			beforeOrder: "a2",
			afterOrder: null,
		});
	});

	it("puts a drop after an open folder at the top of that folder", () => {
		expect(planMove(NODES, "top", node("f2", true), "after")).toEqual({
			parentId: "f2",
			beforeOrder: null,
			afterOrder: "a0",
		});
	});

	it("refuses a folder inside itself or below it, and no-op drops", () => {
		expect(planMove(NODES, "f1", node("f2"), "inside")).toBeNull();
		expect(planMove(NODES, "f1", node("r3"), "before")).toBeNull();
		expect(planMove(NODES, "f1", node("f1"), "inside")).toBeNull();
		expect(planMove(NODES, "r1", node("r2"), "before")).toBeNull();
		expect(planMove(NODES, "r1", node("r2"), "inside")).toBeNull();
	});
});

describe("subtree helpers", () => {
	it("finds every node below a folder", () => {
		expect([...subtreeIds(NODES, "f1")].sort()).toEqual(
			["f1", "f2", "r1", "r2", "r3"].sort(),
		);
		expect(isInSubtree(NODES, "f1", "r3")).toBe(true);
		expect(isInSubtree(NODES, "f2", "r1")).toBe(false);
	});

	it("applies a move with a key between the neighbours", () => {
		const moved = applyMove(NODES, "top", {
			parentId: "f1",
			beforeOrder: "a0",
			afterOrder: "a1",
		});
		const top = moved.find((item) => item.id === "top");
		expect(top?.parentId).toBe("f1");
		expect(top && top.order > "a0" && top.order < "a1").toBe(true);
	});
});
