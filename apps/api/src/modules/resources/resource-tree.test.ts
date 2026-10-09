import { MAX_RESOURCE_DEPTH } from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	type TreeNode,
	attachProblem,
	descendantIds,
	levelOf,
	orderTree,
} from "./resource-tree.js";

const node = (id: string, parentId: string | null, name = id): TreeNode => ({
	id,
	parentId,
	name,
});

/** users → posts → comments, users → likes, tags at the root. */
const TREE = [
	node("comments", "posts"),
	node("users", null),
	node("posts", "users"),
	node("tags", null),
	node("likes", "users"),
];

function chain(length: number): TreeNode[] {
	return Array.from({ length }, (_, i) =>
		node(`n${i}`, i === 0 ? null : `n${i - 1}`),
	);
}

describe("orderTree", () => {
	it("lists parents before children with their depth", () => {
		expect(
			orderTree(TREE).map(({ node: n, depth }) => `${depth}:${n.id}`),
		).toEqual(["0:users", "1:posts", "2:comments", "1:likes", "0:tags"]);
	});

	it("terminates on a cycle and still lists every node once", () => {
		const cyclic = [node("a", "b"), node("b", "a"), node("root", null)];
		const ids = orderTree(cyclic).map((entry) => entry.node.id);
		expect(ids.sort()).toEqual(["a", "b", "root"]);
	});
});

describe("tree queries", () => {
	it("finds descendants and levels", () => {
		expect(descendantIds(TREE, "users").sort()).toEqual([
			"comments",
			"likes",
			"posts",
		]);
		expect(descendantIds(TREE, "tags")).toEqual([]);
		expect(levelOf(TREE, "comments")).toBe(3);
		expect(levelOf([node("a", "b"), node("b", "a")], "a")).toBe(2);
	});
});

describe("attachProblem", () => {
	it("allows a valid new child and a valid move", () => {
		expect(
			attachProblem(TREE, { parentId: "users", name: "orders" }),
		).toBeNull();
		expect(
			attachProblem(TREE, { id: "tags", parentId: "posts", name: "tags" }),
		).toBeNull();
		expect(
			attachProblem(TREE, { id: "posts", parentId: null, name: "posts" }),
		).toBeNull();
	});

	it("refuses itself, its descendants and a missing parent", () => {
		expect(
			attachProblem(TREE, { id: "users", parentId: "users", name: "users" })
				?.code,
		).toBe("SELF_PARENT");
		expect(
			attachProblem(TREE, { id: "users", parentId: "comments", name: "users" })
				?.code,
		).toBe("CYCLE");
		expect(attachProblem(TREE, { parentId: "ghost", name: "x" })?.code).toBe(
			"PARENT_NOT_FOUND",
		);
	});

	it("refuses a sibling name clash but not the same name elsewhere", () => {
		expect(
			attachProblem(TREE, { parentId: "users", name: "posts" })?.code,
		).toBe("DUPLICATE_NAME");
		expect(
			attachProblem(TREE, { id: "tags", parentId: "users", name: "likes" })
				?.code,
		).toBe("DUPLICATE_NAME");
		expect(attachProblem(TREE, { parentId: "tags", name: "posts" })).toBeNull();
		expect(
			attachProblem(TREE, { id: "posts", parentId: "users", name: "posts" }),
		).toBeNull();
	});

	it("caps the depth, counting the subtree that moves along", () => {
		const full = chain(MAX_RESOURCE_DEPTH);
		const last = `n${MAX_RESOURCE_DEPTH - 1}`;
		expect(attachProblem(full, { parentId: last, name: "deeper" })?.code).toBe(
			"TOO_DEEP",
		);
		const nodes = [
			...chain(MAX_RESOURCE_DEPTH - 1),
			node("x", null),
			node("y", "x"),
		];
		expect(
			attachProblem(nodes, {
				id: "x",
				parentId: `n${MAX_RESOURCE_DEPTH - 2}`,
				name: "x",
			})?.code,
		).toBe("TOO_DEEP");
		expect(
			attachProblem(nodes, {
				id: "y",
				parentId: `n${MAX_RESOURCE_DEPTH - 2}`,
				name: "y",
			}),
		).toBeNull();
	});
});
