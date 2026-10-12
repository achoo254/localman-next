import { describe, expect, it } from "vitest";
import { example } from "./collections-fixtures";
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

describe("planMove with examples", () => {
	const WITH_EXAMPLES = [
		...NODES,
		example("e1", "r1", "a0"),
		example("e2", "r1", "a1"),
		example("e3", "r1", "a2"),
		example("x1", "r2", "a0"),
	];

	it("reorders an example among the examples of its request", () => {
		expect(planMove(WITH_EXAMPLES, "e3", node("e1"), "before")).toEqual({
			parentId: "r1",
			beforeOrder: null,
			afterOrder: "a0",
		});
		expect(planMove(WITH_EXAMPLES, "e1", node("e2"), "after")).toEqual({
			parentId: "r1",
			beforeOrder: "a1",
			afterOrder: "a2",
		});
		expect(planMove(WITH_EXAMPLES, "e1", node("e2"), "before")).toBeNull();
	});

	it("keeps examples under their request and other nodes out of them", () => {
		expect(planMove(WITH_EXAMPLES, "e1", node("x1"), "before")).toBeNull();
		expect(planMove(WITH_EXAMPLES, "e1", node("r2"), "after")).toBeNull();
		expect(planMove(WITH_EXAMPLES, "e1", node("f1"), "inside")).toBeNull();
		expect(
			planMove(WITH_EXAMPLES, "e1", { kind: "collection" }, "inside"),
		).toBeNull();
		expect(planMove(WITH_EXAMPLES, "r2", node("e1"), "before")).toBeNull();
		expect(planMove(WITH_EXAMPLES, "e1", node("e2"), "inside")).toBeNull();
	});

	it("moves only the order of an example in the optimistic view", () => {
		const moved = applyMove(WITH_EXAMPLES, "e3", {
			parentId: "r1",
			beforeOrder: null,
			afterOrder: "a0",
		});
		const e3 = moved.find((item) => item.id === "e3");
		expect(e3?.parentId).toBe("r1");
		expect(e3 && e3.order < "a0").toBe(true);
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
