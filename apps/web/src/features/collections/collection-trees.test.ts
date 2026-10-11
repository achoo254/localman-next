import {
	COLLECTION_NAME_MAX,
	type CollectionTree,
	createRequestDraft,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import type {
	MockRequest,
	MockResourceUrls,
} from "../api-client/open-in/mock-requests";
import { fitTree, mockProjectTree } from "./collection-trees";
import { daysLeft } from "./use-trash";

function resource(
	id: string,
	parentId: string | null,
	name: string,
): MockResourceUrls {
	return {
		id,
		name,
		parentId,
		depth: parentId ? 1 : 0,
		collectionUrl: `https://m.test/${name}`,
		itemUrl: `https://m.test/${name}/{id}`,
		endpoints: [],
	};
}

function mockRequest(resourceId: string, name: string): MockRequest {
	return {
		id: `mock:${resourceId}:${name}`,
		resourceId,
		kind: "list",
		draft: createRequestDraft({ name, url: `https://m.test/${name}` }),
	};
}

describe("mockProjectTree", () => {
	it("makes a folder per resource, nested under its parent", () => {
		const tree = mockProjectTree(
			"Shop",
			[resource("u", null, "users"), resource("p", "u", "posts")],
			[mockRequest("u", "List users"), mockRequest("p", "List posts")],
		);
		expect(tree.name).toBe("Shop");
		expect(tree.items).toHaveLength(1);
		const users = tree.items[0];
		expect(users?.kind === "folder" && users.name).toBe("users");
		const names =
			users?.kind === "folder" ? users.items.map((item) => item.name) : [];
		expect(names).toEqual(["List users", "posts"]);
	});
});

describe("fitTree", () => {
	const names = {
		collection: "Imported",
		folder: "Folder",
		request: "Request",
	};

	it("fills blank names and cuts long ones", () => {
		const tree: CollectionTree = {
			name: "  ",
			description: "",
			auth: { type: "none" },
			scripts: { pre: "", post: "" },
			variables: [
				{ key: " ", value: "x" },
				{ key: "baseUrl", value: "https://a.test" },
			],
			items: [
				{
					kind: "folder",
					id: "f",
					name: "",
					description: "",
					auth: { type: "inherit" },
					scripts: { pre: "", post: "" },
					items: [
						{
							kind: "request",
							id: "r",
							name: "",
							description: "",
							draft: createRequestDraft({ url: "https://a.test/x" }),
						},
						{
							kind: "request",
							id: "r2",
							name: "x".repeat(300),
							description: "",
							draft: createRequestDraft(),
						},
					],
				},
			],
		};
		const fitted = fitTree(tree, names);
		expect(fitted.name).toBe("Imported");
		expect(fitted.variables.map((v) => v.key)).toEqual(["baseUrl"]);
		const inner = fitted.items[0];
		expect(inner?.name).toBe("Folder");
		const requests = inner?.kind === "folder" ? inner.items : [];
		expect(requests[0]?.name).toBe("https://a.test/x");
		expect(requests[1]?.name).toHaveLength(COLLECTION_NAME_MAX);
	});
});

describe("daysLeft", () => {
	const now = new Date("2026-10-11T00:00:00Z");

	it("rounds up to whole days and never goes below zero", () => {
		expect(daysLeft("2026-10-18T00:00:00Z", now)).toBe(7);
		expect(daysLeft("2026-10-11T01:00:00Z", now)).toBe(1);
		expect(daysLeft("2026-10-10T00:00:00Z", now)).toBe(0);
		expect(daysLeft("not a date", now)).toBe(0);
	});
});
