import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	MOCK_DOMAIN,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { ProjectModel, type StoredProject } from "../projects/project-model.js";
import { blog } from "./__fixtures__/mock-mcp-blog.js";
import {
	type ListeningApp,
	connectMockMcp,
	errorCodeOf,
	listen,
	viaLoopback,
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

describe("Hosted Mock MCP endpoint", () => {
	it("reads mock://schema and mock://openapi", async () => {
		const { secret } = await blog("/api");
		const client = await fallbackClient(secret, "/api");
		const schema = await client.readResource({ uri: "mock://schema" });
		const [schemaText] = schema.contents;
		const tree = JSON.parse(
			schemaText && "text" in schemaText ? schemaText.text : "{}",
		);
		expect(tree.mcpUrl).toBe(`https://${secret}.${MOCK_DOMAIN}/api/mcp`);
		expect(tree.resources.map((r: { path: string }) => r.path)).toEqual([
			"/users",
			"/users/{userId}/posts",
			"/users/{userId}/posts/{postId}/comments",
		]);
		const openapi = await client.readResource({ uri: "mock://openapi" });
		const [apiText] = openapi.contents;
		const doc = JSON.parse(apiText && "text" in apiText ? apiText.text : "{}");
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.servers).toEqual([
			{ url: `https://${secret}.${MOCK_DOMAIN}/api` },
		]);
		expect(Object.keys(doc.paths)).toContain("/users/{userId}/posts/{id}");
	});

	it("serves {prefix}/mcp on the project's host", async () => {
		const { secret } = await blog("/v1");
		server = await listen(kit.client(secret).app);
		const client = await connectMockMcp(
			`http://${secret}.${MOCK_DOMAIN}/v1/mcp`,
			{
				fetch: viaLoopback(server.port),
			},
		);
		const tools = (await client.listTools()).tools.map((t) => t.name);
		expect(tools.slice(0, 5)).toEqual([
			"list_users",
			"get_users",
			"create_users",
			"update_users",
			"delete_users",
		]);
	});

	it("leaves every other path to REST", async () => {
		const { secret } = await blog("/api");
		const mock = kit.client(secret);
		// Outside the prefix, or a record id "mcp": REST's 404.
		expect((await mock.call("post", "/mcp", {})).body).toBe("Not found");
		expect((await mock.get("/api/users/mcp")).body).toBe("Not found");
		expect((await mock.get("/api/users/1")).status).toBe(200);
	});

	it("counts tool calls into the monthly quota and the project's activity", async () => {
		const { id, secret } = await blog();
		const client = await fallbackClient(secret);
		await client.listTools();
		await client.callTool({ name: "list_users", arguments: {} });
		await client.callTool({ name: "get_users", arguments: { id: "1" } });
		await kit.meter().flush();
		const project = await ProjectModel.findById(id).lean<StoredProject>();
		// tools/list is not a tool call: two requests counted.
		expect(project?.mockRequests).toBe(2);
		expect(project?.lastRequestAt).toBeInstanceOf(Date);
	});

	it("refuses writes past the secret's write rate", async () => {
		const { secret } = await blog();
		server = await listen(
			kit.client(secret, { limits: { writesPerSecret: 1 } }).app,
		);
		const client = await connectMockMcp(`${server.origin}/m/${secret}/mcp`);
		const create = () =>
			client.callTool({ name: "create_users", arguments: { data: {} } });
		const results = [await create(), await create(), await create()];
		expect(results.map(errorCodeOf)).toContain("RATE_LIMITED");
		// Reads do not take writes.
		const read = await client.callTool({ name: "list_users", arguments: {} });
		expect(errorCodeOf(read)).toBeNull();
	});
});
