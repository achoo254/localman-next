import { describe, expect, it } from "vitest";
import {
	MOCK_TOOL_NAME_PATTERN,
	type MockToolNode,
	mockToolEntries,
	mockToolSlug,
} from "./mock-tool-names.js";
import { RESOURCE_ENDPOINTS } from "./resource-constants.js";

const id = (n: number): string => n.toString(16).padStart(24, "0");
const ALL_ENABLED = RESOURCE_ENDPOINTS.map((endpoint) => ({
	...endpoint,
	enabled: true,
}));

function node(
	n: number,
	name: string,
	parent: number | null,
	endpoints: MockToolNode["endpoints"] = ALL_ENABLED,
): MockToolNode {
	return {
		id: id(n),
		parentId: parent === null ? null : id(parent),
		name,
		endpoints,
	};
}

const names = (nodes: readonly MockToolNode[]): string[] =>
	mockToolEntries(nodes).map((entry) => entry.name);

/** `list_` tool name per resource id. */
const listNames = (nodes: readonly MockToolNode[]): Record<string, string> =>
	Object.fromEntries(
		mockToolEntries(nodes)
			.filter((entry) => entry.action === "list")
			.map((entry) => [entry.resource.id, entry.name]),
	);

describe("mockToolEntries", () => {
	it("lists tools parent first, actions in order, with ancestors", () => {
		const entries = mockToolEntries([
			node(3, "comments", 2),
			node(1, "users", null),
			node(2, "posts", 1),
		]);
		expect(entries.map((entry) => entry.name)).toEqual(
			["users", "posts", "comments"].flatMap((res) =>
				["list", "get", "create", "update", "delete"].map(
					(action) => `${action}_${res}`,
				),
			),
		);
		const comments = entries.find((entry) => entry.name === "get_comments");
		expect(comments?.ancestors.map((a) => a.name)).toEqual(["users", "posts"]);
	});

	it("makes tools only for enabled endpoints; a missing one is disabled", () => {
		const some = [
			{ method: "GET", path: "/:res", enabled: false },
			{ method: "GET", path: "/:res/:id", enabled: true },
			{ method: "PUT", path: "/:res/:id", enabled: true },
		];
		expect(names([node(1, "users", null, some)])).toEqual([
			"get_users",
			"update_users",
		]);
		expect(names([node(1, "users", null, [])])).toEqual([]);
	});

	it("keeps names when another resource's endpoints are switched off", () => {
		const tree = [node(1, "a", null), node(2, "x", 1), node(3, "x", null)];
		const off = [node(1, "a", null), node(2, "x", 1), node(3, "x", null, [])];
		expect(listNames(tree)[id(2)]).toBe("list_x_2");
		expect(listNames(off)[id(2)]).toBe("list_x_2");
	});

	it("treats a resource whose parent is missing as a root", () => {
		const [entry] = mockToolEntries([node(2, "posts", 9)]);
		expect(entry?.ancestors).toEqual([]);
	});
});

describe("tool names", () => {
	it("normalizes special characters and long names within the MCP pattern", () => {
		const long = "a".repeat(64);
		const tree = [
			node(1, "my res.v2!", null),
			node(2, long, null),
			node(3, `${long.slice(0, 60)}bbbb`, null),
			node(4, "...", null),
		];
		for (const name of names(tree))
			expect(name).toMatch(MOCK_TOOL_NAME_PATTERN);
		expect(listNames(tree)).toEqual({
			[id(1)]: "list_my_res_v2_",
			[id(2)]: `list_${"a".repeat(57)}`,
			[id(3)]: `list_${"a".repeat(55)}_2`,
			[id(4)]: "list_resource",
		});
		expect(names(tree)).toContain(`delete_${"a".repeat(57)}`);
		expect(new Set(names(tree)).size).toBe(names(tree).length);
	});

	it("suffixes duplicates deterministically, keeping literal names", () => {
		const tree = [
			node(1, "posts", null),
			node(2, "photos", null),
			node(5, "comments", 2),
			node(4, "comments", 1),
			node(3, "comments_2", null),
		];
		const expected = {
			[id(1)]: "list_posts",
			[id(2)]: "list_photos",
			[id(3)]: "list_comments_2",
			[id(4)]: "list_comments",
			[id(5)]: "list_comments_3",
		};
		expect(listNames(tree)).toEqual(expected);
		expect(listNames([...tree].reverse())).toEqual(expected);
	});

	it("keeps case, so siblings Side and side get distinct tools", () => {
		expect(mockToolSlug("Side")).toBe("Side");
		expect(names([node(1, "Side", null), node(2, "side", null)])).toEqual(
			expect.arrayContaining(["list_Side", "list_side"]),
		);
	});
});
