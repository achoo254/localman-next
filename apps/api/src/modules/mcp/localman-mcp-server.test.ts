import type { Client } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
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

const AGENT_USER = "acc_agent";
const USER_INTERFACE = `
/** A user of the shop. */
export interface User {
	id: number;
	name: string;
	email: string;
	age?: number;
	active: boolean;
	createdAt: Date;
}`;

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

async function connect(
	scope = "mock:read mock:write",
	sub = AGENT_USER,
	era?: "modern" | "legacy",
) {
	const client = await connectMcpClient(
		running.url,
		await idp.sign({ scope, sub }),
		era,
	);
	clients.push(client);
	return client;
}

async function call(client: Client, name: string, args: object) {
	return structuredOf(await client.callTool({ name, arguments: { ...args } }));
}

describe("Localman MCP (OAuth) over Streamable HTTP", () => {
	it("creates a project, a resource from a TypeScript interface, data and URLs", async () => {
		const client = await connect();
		const project = await call(client, "create_project", { name: "Shop" });
		const projectId = String(project.id);
		expect(project.uiUrl).toBe(`${TEST_PUBLIC_URL}/projects/${projectId}`);
		// The token's subject got a minimal user row to own the project.
		const user = await UserModel.findOne({ sub: AGENT_USER }).lean();
		expect(user?.username).toBe(AGENT_USER);

		const created = await call(client, "create_resource_from_schema", {
			projectId,
			name: "users",
			format: "typescript",
			source: USER_INTERFACE,
		});
		expect(created.importedFrom).toBe("User");
		expect(created.uiUrl).toBe(project.uiUrl);
		const resource = created.resource as {
			id: string;
			schema: { name: string }[];
		};
		expect(resource.schema.map((field) => field.name)).toEqual([
			"name",
			"email",
			"age",
			"active",
			"createdAt",
		]);

		await call(client, "generate_resource_data", {
			projectId,
			resourceId: resource.id,
			count: 5,
		});
		const data = await call(client, "get_resource_data", {
			projectId,
			resourceId: resource.id,
		});
		expect(data.count).toBe(5);

		const urls = await call(client, "get_mock_urls", { projectId });
		const base = `https://${String(project.secret)}.mock.test`;
		expect(urls).toMatchObject({
			projectId,
			mockBaseUrl: base,
			mcpUrl: `${base}/mcp`,
			uiUrl: project.uiUrl,
			resources: [
				{
					name: "users",
					collectionUrl: `${base}/users`,
					itemUrl: `${base}/users/{id}`,
				},
			],
		});
	});

	it("serves 2025-era clients through the stateless legacy path", async () => {
		const client = await connect(undefined, undefined, "legacy");
		const project = await call(client, "create_project", { name: "Legacy" });
		expect(project.uiUrl).toBe(`${TEST_PUBLIC_URL}/projects/${project.id}`);
	});

	it("offers only the mock toolset, never member, account, notification or admin tools", async () => {
		const client = await connect();
		const names = (await client.listTools()).tools.map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining(["list_projects", "get_mock_urls"]),
		);
		for (const hidden of [
			"list_collaborators",
			"lookup_invitee",
			"invite_collaborator",
			"remove_collaborator",
			"get_magic_link",
			"rotate_magic_link",
			"revoke_magic_link",
			"get_me",
			"list_notifications",
			"list_pro_interests",
		]) {
			expect(names).not.toContain(hidden);
		}
		const toolsets = await call(client, "list_toolsets", {});
		const listed = toolsets.toolsets as { name: string }[];
		expect(listed.map((toolset) => toolset.name)).toEqual(["mock"]);
		const enable = await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "admin" },
		});
		expect(enable.isError).toBe(true);
	});

	it("needs mock:write for writing tools (step-up), mock:read is enough to read", async () => {
		const client = await connect("mock:read");
		const projects = await call(client, "list_projects", {});
		expect(projects.items).toEqual([]);
		await expect(
			client.callTool({ name: "create_project", arguments: { name: "X" } }),
		).rejects.toThrow(/insufficient_scope|mock:write/);
	});

	it("runs as the token's user: other users' projects are not found", async () => {
		const owner = await connect("mock:read mock:write", "acc_owner");
		const project = await call(owner, "create_project", { name: "Private" });
		const stranger = await connect("mock:read mock:write", "acc_stranger");
		const result = await stranger.callTool({
			name: "get_mock_urls",
			arguments: { projectId: String(project.id) },
		});
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result.content)).toContain("NOT_FOUND");
	});

	it("keeps the plan limits of the token's user", async () => {
		const client = await connect("mock:read mock:write", "acc_free");
		for (const name of ["A", "B", "C"]) {
			await call(client, "create_project", { name });
		}
		const fourth = await client.callTool({
			name: "create_project",
			arguments: { name: "D" },
		});
		expect(fourth.isError).toBe(true);
		expect(JSON.stringify(fourth.content)).toContain("PLAN_LIMIT_REACHED");
	});
});
