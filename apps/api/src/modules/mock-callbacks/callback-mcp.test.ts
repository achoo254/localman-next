import type { Client } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	TEST_PUBLIC_URL,
	type TestIdp,
	createTestIdp,
} from "../mcp/testing/idp-token-signer.js";
import {
	type RunningApp,
	connectMcpClient,
	createMcpTestApp,
	listenOnLoopback,
} from "../mcp/testing/localman-mcp-harness.js";
import { structuredOf } from "../mcp/testing/tool-structured-content.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import { HIDDEN_HEADER_VALUE } from "./callback-headers.js";

useMockTestKit({ settings: () => ({ publicUrl: TEST_PUBLIC_URL }) });

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

describe("get_resource_callbacks over Localman MCP", () => {
	it("hides header values even from the owner's token", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, { name: "users" });
		const path = `/projects/${project.id}/resources/${users.id}/callbacks`;
		const set = await as(OWNER).send("put", path, {
			callbacks: [
				{
					on: "create",
					target: { kind: "tunnel", port: 3000, path: "/h" },
					bodyTemplate: '{"r":{{record}}}',
					headers: [{ name: "X-Hook-Secret", value: "whsec_1" }],
				},
			],
		});
		expect(set.status, JSON.stringify(set.body)).toBe(200);

		const token = await idp.sign({ scope: "mock:read", sub: OWNER });
		const client = await connectMcpClient(running.url, token);
		clients.push(client);
		await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "traffic" },
		});
		const read = structuredOf(
			await client.callTool({
				name: "get_resource_callbacks",
				arguments: { projectId: project.id, resourceId: users.id },
			}),
		);
		expect(read).toMatchObject({
			canManage: true,
			callbacks: [
				{
					bodyTemplate: '{"r":{{record}}}',
					headers: [
						{ name: "X-Hook-Secret", value: HIDDEN_HEADER_VALUE, hidden: true },
					],
				},
			],
		});
		expect(JSON.stringify(read)).not.toContain("whsec_1");
	});
});
