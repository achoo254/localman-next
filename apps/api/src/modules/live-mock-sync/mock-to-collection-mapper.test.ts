import { completeEndpoints } from "@localman/shared";
import type { CollectionNode } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	type MockSyncResource,
	idVariablesOf,
	mockToCollection,
} from "./mock-to-collection-mapper.js";
import { DEFAULT_SYNC_NAMES } from "./sync-names.js";

const resource = (
	id: string,
	name: string,
	parentId: string | null = null,
	overrides: Partial<MockSyncResource> = {},
): MockSyncResource => ({
	id,
	name,
	parentId,
	schema: [
		{ name: "id", type: "Faker.js", fakerMethod: "string.uuid" },
		{ name: "name", type: "String" },
		{ name: "age", type: "Number" },
	],
	endpoints: completeEndpoints(),
	...overrides,
});

/** `url` of each request, by node key: what a snapshot can read at a glance. */
function urls(nodes: Record<string, CollectionNode>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const node of Object.values(nodes)) {
		if (node.kind === "request") out[node.id] = node.draft.url;
	}
	return out;
}

describe("mockToCollection", () => {
	it("maps a flat resource to a folder of CRUD requests", () => {
		const nodes = mockToCollection(
			[resource("u", "users")],
			DEFAULT_SYNC_NAMES,
		);
		expect(urls(nodes)).toMatchInlineSnapshot(`
			{
			  "mock:u:DELETE:item": "{{baseUrl}}/users/{{userId}}",
			  "mock:u:GET:collection": "{{baseUrl}}/users",
			  "mock:u:GET:item": "{{baseUrl}}/users/{{userId}}",
			  "mock:u:PATCH:item": "{{baseUrl}}/users/{{userId}}",
			  "mock:u:POST:collection": "{{baseUrl}}/users",
			  "mock:u:PUT:item": "{{baseUrl}}/users/{{userId}}",
			}
		`);
		const folder = nodes["mock:u:folder"];
		expect(folder).toMatchObject({
			kind: "folder",
			name: "users",
			parentId: null,
		});
		const create = nodes["mock:u:POST:collection"];
		expect(create?.kind === "request" && create.draft.body.raw).toBe(
			'{\n  "name": "",\n  "age": 0\n}',
		);
		expect(create?.name).toBe("Create in users");
		// GETs carry an example answer built from the schema.
		const example = nodes["mock:u:GET:collection:example"];
		expect(
			example?.kind === "example" && JSON.parse(example.response.body),
		).toEqual([{ id: "1", name: "", age: 0 }]);
	});

	it("nests resources three levels deep under one record of each parent", () => {
		const nodes = mockToCollection(
			[
				resource("u", "users"),
				resource("p", "posts", "u"),
				resource("c", "comments", "p"),
			],
			DEFAULT_SYNC_NAMES,
		);
		expect(nodes["mock:c:GET:item"]).toMatchObject({
			parentId: "mock:c:folder",
			draft: {
				url: "{{baseUrl}}/users/{{userId}}/posts/{{postId}}/comments/{{commentId}}",
			},
		});
		expect(nodes["mock:c:folder"]?.parentId).toBe("mock:p:folder");
		expect(nodes["mock:p:folder"]?.parentId).toBe("mock:u:folder");
		// A child folder comes after the requests of the folder it sits in.
		const inUsers = Object.values(nodes)
			.filter((node) => node.parentId === "mock:u:folder")
			.sort((a, b) => (a.order < b.order ? -1 : 1));
		expect(inUsers.at(-1)?.id).toBe("mock:p:folder");
		expect(
			idVariablesOf([resource("u", "users"), resource("p", "posts", "u")]),
		).toEqual(["userId", "postId"]);
	});

	it("leaves out the requests of disabled endpoints", () => {
		const endpoints = completeEndpoints([
			{ method: "DELETE", path: "/:res/:id", enabled: false },
			{ method: "PUT", path: "/:res/:id", enabled: false },
		]);
		const nodes = mockToCollection(
			[resource("u", "users", null, { endpoints })],
			DEFAULT_SYNC_NAMES,
		);
		expect(Object.keys(urls(nodes)).sort()).toEqual([
			"mock:u:GET:collection",
			"mock:u:GET:item",
			"mock:u:POST:collection",
		]);
	});

	it("gives the same output for the same input", () => {
		const input = [resource("u", "users"), resource("p", "posts", "u")];
		expect(mockToCollection(input, DEFAULT_SYNC_NAMES)).toEqual(
			mockToCollection(input, DEFAULT_SYNC_NAMES),
		);
	});
});
