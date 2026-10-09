import type { Client } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import {
	TEST_PUBLIC_URL,
	type TestIdp,
	createTestIdp,
} from "./testing/idp-token-signer.js";
import {
	type RunningApp,
	connectMcpClient,
	createMcpTestApp,
	listenOnLoopback,
} from "./testing/localman-mcp-harness.js";
import { structuredOf } from "./testing/tool-structured-content.js";

useDashboardTestDb(() => ({
	publicUrl: TEST_PUBLIC_URL,
	mockBaseDomain: "mock.test",
}));

const AGENT_USER = "acc_agent_advanced";
let idp: TestIdp;
let running: RunningApp;
const clients: Client[] = [];
beforeAll(async () => {
	idp = await createTestIdp();
	running = await listenOnLoopback(createMcpTestApp(idp));
});
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
afterAll(async () => {
	await running.close();
});

async function connect(scope: string, query = "") {
	const token = await idp.sign({ scope, sub: AGENT_USER });
	const client = await connectMcpClient(running.url, token, "modern", query);
	clients.push(client);
	return client;
}

async function call(client: Client, name: string, args: object) {
	return structuredOf(await client.callTool({ name, arguments: { ...args } }));
}

describe("mock-advanced tools over Localman MCP", () => {
	it("opens with the mock:* scopes and imports resources with seed data", async () => {
		const client = await connect("mock:read mock:write");
		const toolsets = await call(client, "list_toolsets", {});
		expect(toolsets.toolsets).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "mock-advanced", enabled: false }),
			]),
		);
		await call(client, "enable_toolset", { toolset: "mock-advanced" });
		const names = (await client.listTools()).tools.map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"import_resources",
				"export_resource_types",
				"suggest_faker_methods",
			]),
		);

		const project = await call(client, "create_project", { name: "Shop" });
		const args = {
			projectId: project.id,
			format: "json",
			input: [{ title: "Pen", price: 2 }],
			name: "products",
		};
		const preview = await call(client, "import_resources", {
			...args,
			dry_run: true,
		});
		expect(preview).toMatchObject({ dryRun: true, created: [] });
		const done = await call(client, "import_resources", args);
		expect(done.created).toEqual([
			expect.objectContaining({ name: "products", count: 1 }),
		]);
		const types = await call(client, "export_resource_types", {
			projectId: project.id,
			format: "typescript",
		});
		expect(types.code).toContain("export interface Product {");
	});

	it("lets mock:read suggest and export, but importing needs mock:write", async () => {
		const client = await connect("mock:read", "?toolsets=mock,mock-advanced");
		const suggested = await call(client, "suggest_faker_methods", {
			fields: [{ name: "avatarUrl" }],
		});
		expect(suggested.suggestions).toEqual([
			expect.objectContaining({ name: "avatarUrl", method: "image.avatar" }),
		]);
		await expect(
			client.callTool({
				name: "import_resources",
				arguments: { projectId: "x", format: "csv", input: "a\n1" },
			}),
		).rejects.toThrow(/insufficient_scope|mock:write/);
	});
});
