import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import { describe, expect, it } from "vitest";
import {
	canConnect,
	connectProblem,
	connectProblemMessage,
} from "./can-connect";
import { SAMPLE_TREE } from "./tree-fixtures";
import type { TreeItem } from "./tree-layout";

describe("canConnect on users → posts → comments, likes", () => {
	it.each([
		["likes", "users"],
		["likes", "comments"],
		["comments", "users"],
		["comments", null],
		["posts", "likes"],
	])("allows %s under %s", (moving, target) => {
		expect(canConnect(SAMPLE_TREE, moving, target)).toBe(true);
	});

	it.each([
		["users", "users", "self"],
		["posts", "users", "already-there"],
		["users", null, "already-there"],
		["users", "posts", "cycle"],
		["users", "comments", "cycle"],
		["posts", "comments", "cycle"],
		["ghost", "users", "missing"],
		["likes", "ghost", "missing"],
	] as const)("refuses %s under %s (%s)", (moving, target, problem) => {
		expect(connectProblem(SAMPLE_TREE, moving, target)).toBe(problem);
		expect(canConnect(SAMPLE_TREE, moving, target)).toBe(false);
	});

	it("refuses a sibling with the same name (case-sensitive like the API)", () => {
		const tree: TreeItem[] = [
			...SAMPLE_TREE,
			{ id: "posts-2", parentId: null, name: "posts" },
			{ id: "Posts", parentId: null, name: "Posts" },
		];
		expect(connectProblem(tree, "posts-2", "users")).toBe("name-taken");
		expect(connectProblem(tree, "Posts", "users")).toBeNull();
	});

	it("refuses trees deeper than the API allows", () => {
		const chain: TreeItem[] = Array.from(
			{ length: MAX_RESOURCE_DEPTH },
			(_, i) => ({
				id: `r${i}`,
				parentId: i === 0 ? null : `r${i - 1}`,
				name: `r${i}`,
			}),
		);
		const tree = [...chain, { id: "x", parentId: null, name: "x" }];
		const deepest = `r${MAX_RESOURCE_DEPTH - 1}`;
		expect(connectProblem(tree, "x", deepest)).toBe("too-deep");
		expect(connectProblem(tree, "x", `r${MAX_RESOURCE_DEPTH - 2}`)).toBeNull();
	});
});

describe("connectProblemMessage", () => {
	it("explains each refusal in Vietnamese", () => {
		expect(connectProblemMessage("cycle", "users", "posts")).toBe(
			"Không thể lồng users vào posts vì sẽ tạo vòng lặp.",
		);
		expect(connectProblemMessage("already-there", "users", null)).toBe(
			"users đã ở root.",
		);
		expect(connectProblemMessage("name-taken", "posts", "users")).toBe(
			"Đã có resource tên posts ở vị trí này.",
		);
	});
});
