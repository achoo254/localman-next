import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
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

const reply = (status: number, body: unknown) => ({ status, body });

describe("rules and chaos over Hosted Mock MCP", () => {
	it("applies body, query and nth rules and injects chaos", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, {
			name: "users",
			schema: [{ name: "name", type: "String" }],
			endpoints: [
				{
					method: "POST",
					path: "/:res",
					rules: [
						{
							match: { source: "header", key: "x-role" },
							op: "exists",
							response: reply(403, { header: true }),
						},
						{
							match: { source: "body", path: "$.name" },
							op: "eq",
							value: "Eve",
							response: reply(409, { error: "taken" }),
						},
					],
				},
				{
					method: "GET",
					path: "/:res",
					rules: [
						{
							match: { source: "query", key: "limit" },
							op: "gt",
							value: 50,
							response: reply(200, { tooMany: true }),
						},
						{
							match: { source: "nth" },
							op: "eq",
							value: 3,
							response: reply(200, "$count"),
						},
					],
				},
				{ method: "DELETE", path: "/:res/:id", chaos: { errorRate: 1 } },
			],
		});
		await generate(OWNER, project.id, users.id, 2);
		server = await listen(kit.client(project.secret).app);
		const client = await connectMockMcp(
			`${server.origin}/m/${project.secret}/mcp`,
		);
		const call = (name: string, args: Record<string, unknown>) =>
			client.callTool({ name, arguments: args });

		const taken = await call("create_users", { data: { name: "Eve" } });
		expect(taken.isError).toBe(true);
		expect(taken.content).toEqual([
			{ type: "text", text: JSON.stringify({ error: "taken" }) },
		]);
		const created = await call("create_users", { data: { name: "Ann" } });
		expect(created.isError).not.toBe(true);

		const big = await call("list_users", { limit: 99 });
		expect(big.structuredContent).toEqual({ tooMany: true });
		await call("list_users", {});
		const third = await call("list_users", {});
		expect(third.structuredContent).toEqual({ result: 3 });

		const failed = await call("delete_users", { id: "1" });
		expect(errorCodeOf(failed)).toBe("MOCK_CHAOS_ERROR");
	});
});
