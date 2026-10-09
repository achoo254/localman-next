import { describe, expect, it } from "vitest";
import { connectProblem } from "../../features/resource-tree/can-connect";
import { SAMPLE_TREE } from "../../features/resource-tree/tree-fixtures";
import type { TreeItem } from "../../features/resource-tree/tree-layout";
import {
	type EndpointGroup,
	RELATIONS_SEED,
	endpointCount,
	endpointGroups,
} from "./relations-endpoints";

function move(
	items: readonly TreeItem[],
	id: string,
	parentId: string | null,
): TreeItem[] {
	expect(connectProblem(items, id, parentId)).toBeNull();
	return items.map((item) => (item.id === id ? { ...item, parentId } : item));
}

/** `name: METHOD… path | METHOD… path` per group, for readable expectations. */
function lines(groups: readonly EndpointGroup[]): string[] {
	return groups.map(
		(group) =>
			`${group.name}: ${group.lines
				.map((line) => `${line.methods.join(" ")} ${line.path}`)
				.join(" | ")}`,
	);
}

const root = (name: string) =>
	`${name}: GET POST /${name} | GET PUT DELETE /${name}/:id`;
const nested = (name: string, parent: string, key: string) =>
	`${root(name)} | GET POST /${parent}/:${key}/${name} | GET PUT DELETE /${parent}/:${key}/${name}/:id`;

describe("endpointGroups (landing relations demo)", () => {
	it("A. default seed: users › posts, comments and likes at the root (25)", () => {
		const groups = endpointGroups(RELATIONS_SEED);
		expect(lines(groups)).toEqual([
			root("users"),
			root("comments"),
			root("likes"),
			nested("posts", "users", "userId"),
		]);
		expect(endpointCount(groups)).toBe(25);
	});

	it("B. comments nested into posts (30), same as SAMPLE_TREE", () => {
		const items = move(RELATIONS_SEED, "comments", "posts");
		expect(lines(endpointGroups(items))).toEqual([
			root("users"),
			root("likes"),
			nested("posts", "users", "userId"),
			nested("comments", "posts", "postId"),
		]);
		expect(endpointCount(endpointGroups(items))).toBe(30);
		expect(lines(endpointGroups(SAMPLE_TREE))).toEqual(
			lines(endpointGroups(items)),
		);
	});

	it("C. posts moved back to the root (20)", () => {
		const items = move(RELATIONS_SEED, "posts", null);
		expect(lines(endpointGroups(items))).toEqual([
			root("users"),
			root("posts"),
			root("comments"),
			root("likes"),
		]);
		expect(endpointCount(endpointGroups(items))).toBe(20);
	});

	it("D. from B, likes nested into users: siblings keep tree order (35)", () => {
		const b = move(RELATIONS_SEED, "comments", "posts");
		const items = move(b, "likes", "users");
		expect(lines(endpointGroups(items))).toEqual([
			root("users"),
			nested("posts", "users", "userId"),
			nested("likes", "users", "userId"),
			nested("comments", "posts", "postId"),
		]);
		expect(endpointCount(endpointGroups(items))).toBe(35);
	});

	it("refuses nesting users into posts (cycle) and keeps the 25 endpoints", () => {
		expect(connectProblem(RELATIONS_SEED, "users", "posts")).toBe("cycle");
		expect(endpointCount(endpointGroups(RELATIONS_SEED))).toBe(25);
	});
});
