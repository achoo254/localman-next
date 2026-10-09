import type { CallToolResult } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	OWNER,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { resourcesPath } from "../resources/testing/resource-fixture.js";
import { blog } from "./__fixtures__/mock-mcp-blog.js";
import {
	type ListeningApp,
	connectMockMcp,
	errorCodeOf,
	listen,
} from "./__fixtures__/mock-mcp-test-client.js";
import { clearMockToolsCache } from "./mock-mcp-tools-cache.js";

const kit = useMockTestKit();
let server: ListeningApp | undefined;

beforeEach(() => clearMockToolsCache());
afterEach(async () => {
	await server?.close();
	server = undefined;
});

/** The SDK client on `/m/{secret}{prefix}/mcp` over real HTTP. */
async function fallbackClient(secret: string, prefix = "") {
	server = await listen(kit.client(secret).app);
	return connectMockMcp(`${server.origin}/m/${secret}${prefix}/mcp`);
}

function structured(result: CallToolResult): unknown {
	expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
	return result.structuredContent;
}

describe("Hosted Mock MCP tools", () => {
	it("lists with filter, sort and paging exactly like REST", async () => {
		const { secret } = await blog();
		const client = await fallbackClient(secret);
		const result = await client.callTool({
			name: "list_users",
			arguments: { name: "a", sortBy: "age", order: "desc", page: 1, limit: 2 },
		});
		const rest = await kit
			.client(secret)
			.get("/users?name=a&sortBy=age&order=desc&page=1&limit=2");
		expect(rest.status).toBe(200);
		// Grace, Alan, Ada contain "a"; Linus does not.
		expect(structured(result)).toEqual({ items: rest.body, total: 3 });
		expect(rest.body.map((u: { name: string }) => u.name)).toEqual([
			"Grace",
			"Alan",
		]);
	});

	it("creates nested records that REST serves at once", async () => {
		const { secret } = await blog();
		const client = await fallbackClient(secret);
		const post = structured(
			await client.callTool({
				name: "create_posts",
				arguments: { parentId: "3", data: { title: "COBOL" } },
			}),
		);
		expect(post).toEqual({ id: "3", userId: "3", title: "COBOL" });
		const rest = await kit.client(secret).get("/users/3/posts/3");
		expect(rest.status).toBe(200);
		expect(rest.body).toEqual(post);

		// Two levels down: the user is found from the post's parent link.
		const comment = structured(
			await client.callTool({
				name: "create_comments",
				arguments: { parentId: "3", data: { body: "Nice" } },
			}),
		);
		const comments = await kit.client(secret).get("/users/3/posts/3/comments");
		expect(comments.body).toEqual([comment]);
	});

	it("answers NOT_FOUND for a missing parent or record, like REST's 404", async () => {
		const { secret } = await blog();
		const client = await fallbackClient(secret);
		const orphan = await client.callTool({
			name: "create_posts",
			arguments: { parentId: "99", data: { title: "x" } },
		});
		expect(errorCodeOf(orphan)).toBe("NOT_FOUND");
		const wrongParent = await client.callTool({
			name: "get_posts",
			arguments: { parentId: "1", id: "1" },
		});
		expect(errorCodeOf(wrongParent)).toBe("NOT_FOUND");
		const missing = await client.callTool({
			name: "create_posts",
			arguments: { data: { title: "x" } },
		});
		expect(errorCodeOf(missing)).toBe("VALIDATION_ERROR");
	});

	it("updates and deletes through the same store", async () => {
		const { secret } = await blog();
		const client = await fallbackClient(secret);
		await client.callTool({
			name: "update_users",
			arguments: { id: "1", data: { age: 37 } },
		});
		expect((await kit.client(secret).get("/users/1")).body.age).toBe(37);
		await client.callTool({ name: "delete_users", arguments: { id: "2" } });
		expect((await kit.client(secret).get("/users/2/posts")).status).toBe(404);
	});

	it("has no tool for a disabled endpoint and follows tree changes", async () => {
		const { id, secret, users } = await blog();
		const client = await fallbackClient(secret);
		const before = (await client.listTools()).tools.map((t) => t.name);
		expect(before).toContain("delete_users");
		const changed = await as(OWNER).send(
			"put",
			resourcesPath(id, `/${users.id}`),
			{
				name: "people",
				endpoints: [{ method: "DELETE", path: "/:res/:id", enabled: false }],
			},
		);
		expect(changed.status, JSON.stringify(changed.body)).toBe(200);
		const after = (await client.listTools({}, { cacheMode: "bypass" })).tools;
		const names = after.map((t) => t.name);
		expect(names).toContain("list_people");
		expect(names).not.toContain("delete_people");
		expect(names).not.toContain("list_users");
	});

	it("never applies custom responses", async () => {
		const { id, secret, users } = await blog();
		await as(OWNER).send("put", resourcesPath(id, `/${users.id}`), {
			name: "users",
			endpoints: [
				{
					method: "GET",
					path: "/:res/:id",
					enabled: true,
					response: { wrapped: "$mockData" },
				},
			],
		});
		expect((await kit.client(secret).get("/users/1")).body).toHaveProperty(
			"wrapped",
		);
		const client = await fallbackClient(secret);
		const result = await client.callTool({
			name: "get_users",
			arguments: { id: "1" },
		});
		expect(structured(result)).toEqual({ id: "1", name: "Ada", age: 36 });
	});
});
