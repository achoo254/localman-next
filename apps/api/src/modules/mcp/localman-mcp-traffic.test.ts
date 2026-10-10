import type { Client } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { operations } from "../../operations/registry.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { toolsetsOpenedBy } from "./localman-mcp-access.js";
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

const AGENT_USER = "acc_agent_traffic";
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

async function connect(scope: string) {
	const token = await idp.sign({ scope, sub: AGENT_USER });
	const client = await connectMcpClient(running.url, token, "modern");
	clients.push(client);
	await client.callTool({
		name: "enable_toolset",
		arguments: { toolset: "traffic" },
	});
	return client;
}

describe("traffic tools over Localman MCP with OAuth", () => {
	it("are opened by the mock:* scopes", () => {
		const opened = toolsetsOpenedBy(["mock:read"], operations);
		expect(opened.has("traffic")).toBe(true);
	});

	it("read the request log and inboxes with mock:read", async () => {
		const writer = await connect("mock:read mock:write");
		const project = structuredOf(
			await writer.callTool({
				name: "create_project",
				arguments: { name: "Hooks" },
			}),
		);
		const reader = await connect("mock:read");
		const names = (await reader.listTools()).tools.map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"list_request_logs",
				"list_webhook_inboxes",
				"get_resource_callbacks",
			]),
		);
		// Changing where data goes stays in the UI.
		expect(names).not.toContain("set_webhook_inbox_forward");
		expect(names).not.toContain("set_resource_callbacks");
		const logs = structuredOf(
			await reader.callTool({
				name: "list_request_logs",
				arguments: { projectId: project.id },
			}),
		);
		expect(logs).toMatchObject({ items: [], nextCursor: null });
		const inboxes = structuredOf(
			await reader.callTool({
				name: "list_webhook_inboxes",
				arguments: { projectId: project.id },
			}),
		);
		expect(inboxes).toMatchObject({ items: [], used: 0, max: 2 });

		await expect(
			reader.callTool({
				name: "create_webhook_inbox",
				arguments: { projectId: project.id, name: "stripe" },
			}),
		).rejects.toThrow(/insufficient_scope|mock:write/);
		const created = structuredOf(
			await writer.callTool({
				name: "create_webhook_inbox",
				arguments: { projectId: project.id, name: "stripe" },
			}),
		);
		expect(created).toMatchObject({ name: "stripe", forward: null });
	});
});
