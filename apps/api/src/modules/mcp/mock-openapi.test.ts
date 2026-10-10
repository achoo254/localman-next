import { type EndpointInput, completeEndpoints } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { collectionPath } from "./mock-api-paths.js";
import type { MockApiResource } from "./mock-mcp-tools-cache.js";
import { buildMockOpenApi } from "./mock-openapi.js";

const id = (n: number): string => n.toString(16).padStart(24, "0");

function resource(
	n: number,
	name: string,
	parent: number | null,
	options: Partial<Pick<MockApiResource, "schema" | "template">> & {
		endpoints?: EndpointInput[];
	} = {},
): MockApiResource {
	return {
		id: id(n),
		parentId: parent === null ? null : id(parent),
		name,
		schema: options.schema ?? [{ name: "name", type: "String" }],
		template: options.template ?? null,
		endpoints: completeEndpoints(options.endpoints ?? []),
	};
}

const BLOG: readonly MockApiResource[] = [
	resource(1, "users", null, {
		schema: [
			{ name: "name", type: "String" },
			{ name: "age", type: "Number" },
			{ name: "posts", type: "Child Resource", childId: id(2) },
		],
	}),
	resource(2, "posts", 1, {
		schema: [
			{ name: "title", type: "String" },
			{ name: "author", type: "Parent Resource" },
		],
		endpoints: [
			{ method: "DELETE", path: "/:res/:id", enabled: false },
			{
				method: "GET",
				path: "/:res",
				enabled: true,
				response: { n: "$count" },
			},
		],
	}),
	resource(3, "comments", 2, { template: { body: "$lorem.sentence" } }),
];

const doc = buildMockOpenApi({
	title: "Blog",
	serverUrl: "https://abc.localman.test/api",
	resources: BLOG,
});

function at(path: string): Record<string, unknown> {
	const paths = doc.paths as Record<string, Record<string, unknown>>;
	const item = paths[path];
	if (!item) throw new Error(`No path ${path}`);
	return item;
}

describe("buildMockOpenApi", () => {
	it("describes OpenAPI 3.1 with the mock's base URL", () => {
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.info).toMatchObject({ title: "Blog", version: "1.0.0" });
		expect(doc.servers).toEqual([{ url: "https://abc.localman.test/api" }]);
	});

	it("lists every enabled endpoint on its nested route", () => {
		expect(Object.keys(doc.paths as object)).toEqual([
			"/users",
			"/users/{id}",
			"/users/{userId}/posts",
			"/users/{userId}/posts/{id}",
			"/users/{userId}/posts/{postId}/comments",
			"/users/{userId}/posts/{postId}/comments/{id}",
		]);
		expect(Object.keys(at("/users/{id}"))).toEqual([
			"get",
			"put",
			"patch",
			"delete",
		]);
		// DELETE of posts is disabled.
		expect(Object.keys(at("/users/{userId}/posts/{id}"))).toEqual([
			"get",
			"put",
			"patch",
		]);
	});

	it("names operations after the MCP tools and takes path params", () => {
		const get = at("/users/{userId}/posts/{id}").get;
		expect(get).toMatchObject({
			operationId: "get_posts",
			parameters: [
				{ name: "userId", in: "path", required: true },
				{ name: "id", in: "path", required: true },
			],
		});
		expect(at("/users/{id}").patch).toMatchObject({
			operationId: "patch_users",
		});
		const list = at("/users").get as { parameters: { name: string }[] };
		expect(list.parameters.map((p) => p.name)).toEqual([
			"search",
			"sortBy",
			"order",
			"page",
			"limit",
		]);
	});

	it("types records from the schema or the object template", () => {
		const schemas = (doc.components as { schemas: Record<string, unknown> })
			.schemas;
		expect(schemas.users).toMatchObject({
			properties: {
				id: { type: "string" },
				name: { type: "string" },
				age: { type: "number" },
				posts: { type: "array" },
			},
			required: ["id"],
		});
		expect(schemas.posts).toMatchObject({
			properties: { userId: { type: "string" }, author: { type: "object" } },
		});
		expect(schemas.comments).toMatchObject({
			properties: { id: {}, postId: {}, body: {} },
		});
		expect(schemas.usersInput).toEqual({
			type: "object",
			properties: { name: { type: "string" }, age: { type: "number" } },
			additionalProperties: true,
		});
		const post = at("/users").post as {
			requestBody: unknown;
			responses: Record<string, unknown>;
		};
		expect(post.requestBody).toMatchObject({
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/usersInput" },
				},
			},
		});
		expect(post.responses["201"]).toMatchObject({
			content: {
				"application/json": { schema: { $ref: "#/components/schemas/users" } },
			},
		});
	});

	it("leaves the body of a custom response untyped", () => {
		const list = at("/users/{userId}/posts").get as {
			responses: Record<string, { description: string; content: unknown }>;
		};
		expect(list.responses["200"]).toEqual({
			description: "Custom response template, rendered per request",
			content: { "application/json": { schema: {} } },
		});
	});

	it("is empty but valid without resources", () => {
		const empty = buildMockOpenApi({
			title: "x",
			serverUrl: "u",
			resources: [],
		});
		expect(empty.paths).toEqual({});
	});
});

describe("collectionPath", () => {
	it("numbers a parent parameter repeated along the path", () => {
		const node = (id: string, parentId: string | null, name: string) => ({
			id,
			parentId,
			name,
		});
		expect(
			collectionPath([
				node("1", null, "items"),
				node("2", "1", "items"),
				node("3", "2", "parts"),
			]),
		).toEqual({
			path: "/items/{itemId}/items/{itemId2}/parts",
			params: ["itemId", "itemId2"],
		});
	});
});
