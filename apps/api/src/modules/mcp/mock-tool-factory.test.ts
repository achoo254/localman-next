import {
	type EndpointInput,
	type ResourceFieldDefinition,
	completeEndpoints,
} from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	type MockToolDefinition,
	type MockToolResource,
	buildMockTools,
} from "./mock-tool-factory.js";

const id = (n: number): string => n.toString(16).padStart(24, "0");

function resource(
	n: number,
	name: string,
	parent: number | null,
	options: {
		schema?: readonly ResourceFieldDefinition[];
		template?: MockToolResource["template"];
		endpoints?: readonly EndpointInput[];
	} = {},
): MockToolResource {
	return {
		id: id(n),
		parentId: parent === null ? null : id(parent),
		name,
		schema: options.schema ?? [{ name: "name", type: "String" }],
		template: options.template ?? null,
		endpoints: completeEndpoints(
			options.endpoints ? [...options.endpoints] : [],
		),
	};
}

const BLOG: readonly MockToolResource[] = [
	resource(1, "users", null, {
		schema: [
			{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
			{ name: "age", type: "Number" },
			{ name: "active", type: "Boolean" },
			{ name: "joinedAt", type: "Date" },
			{ name: "posts", type: "Child Resource", childId: id(2) },
		],
	}),
	resource(2, "posts", 1, {
		schema: [
			{ name: "title", type: "String" },
			{ name: "tags", type: "Array" },
			{ name: "meta", type: "Object" },
			{ name: "author", type: "Parent Resource" },
		],
	}),
	resource(3, "comments", 2, { schema: [{ name: "body", type: "String" }] }),
];

function tool(tools: MockToolDefinition[], name: string): MockToolDefinition {
	const found = tools.find((candidate) => candidate.name === name);
	if (!found) throw new Error(`No tool ${name}`);
	return found;
}

const names = (tools: MockToolDefinition[]): string[] =>
	tools.map((candidate) => candidate.name);

describe("buildMockTools", () => {
	it("describes the users → posts → comments tree", () => {
		expect(buildMockTools(BLOG)).toMatchSnapshot();
	});

	it("gives every resource five tools, ancestors first, same for any input order", () => {
		const tools = buildMockTools(BLOG);
		expect(names(tools)).toHaveLength(15);
		expect(names(tools).slice(0, 5)).toEqual([
			"list_users",
			"get_users",
			"create_users",
			"update_users",
			"delete_users",
		]);
		expect(buildMockTools([...BLOG].reverse())).toEqual(tools);
		expect(tool(tools, "list_comments").target).toEqual({
			resourceId: id(3),
			action: "list",
			parentChain: [id(1), id(2)],
		});
	});

	it("skips disabled and missing endpoints", () => {
		const users = resource(1, "users", null, {
			endpoints: [
				{ method: "GET", path: "/:res", enabled: false },
				{ method: "DELETE", path: "/:res/:id", enabled: false },
			],
		});
		expect(names(buildMockTools([users]))).toEqual([
			"get_users",
			"create_users",
			"update_users",
		]);
		const bare = { ...users, endpoints: [] };
		expect(buildMockTools([bare])).toEqual([]);
	});

	it("sets the annotations per action", () => {
		const tools = buildMockTools([resource(1, "users", null)]);
		expect(tool(tools, "list_users").annotations).toEqual({
			readOnlyHint: true,
		});
		expect(tool(tools, "get_users").annotations).toMatchObject({
			readOnlyHint: true,
			idempotentHint: true,
		});
		expect(tool(tools, "create_users").annotations.destructiveHint).toBe(false);
		expect(tool(tools, "update_users").annotations).toMatchObject({
			destructiveHint: false,
			idempotentHint: true,
		});
		expect(tool(tools, "delete_users").annotations).toMatchObject({
			destructiveHint: true,
			idempotentHint: true,
		});
	});
});
