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

const AGENT_USER = "acc_agent_client_scopes";
/** Link-local: the proxy refuses it after the tool's scope checks passed. */
const BLOCKED_TARGET = "http://169.254.169.254/latest/meta-data";

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

async function toolNames(client: Client): Promise<string[]> {
	return (await client.listTools()).tools.map((tool) => tool.name);
}

async function toolsetNames(client: Client): Promise<unknown[]> {
	const listed = await call(client, "list_toolsets", {});
	const toolsets = listed.toolsets as { name: string }[];
	return toolsets.map((toolset) => toolset.name);
}

const sendArgs = { method: "GET", url: BLOCKED_TARGET, headers: [] };

describe("send_request needs client:send over Localman MCP", () => {
	it("is refused by step-up without client:send, even with client:write", async () => {
		const client = await connect("client:read client:write");
		const tools = (await client.listTools()).tools;
		const send = tools.find((tool) => tool.name === "send_request");
		expect(send?._meta?.["localman/scopes"]).toEqual([
			"client:write",
			"client:send",
		]);
		await expect(
			client.callTool({ name: "send_request", arguments: sendArgs }),
		).rejects.toThrow(
			/Insufficient scope: required "client:write client:send"/,
		);
	});

	it("runs with client:send: the proxy itself answers", async () => {
		const client = await connect("client:read client:write client:send");
		const result = await client.callTool({
			name: "send_request",
			arguments: sendArgs,
		});
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result.content)).toContain("PROXY_TARGET_BLOCKED");
	});
});

describe("sharing tools over Localman MCP with the client:* scopes", () => {
	it("are offered to a client:read token, and mock tools are not", async () => {
		const client = await connect("client:read");
		expect(await toolsetNames(client)).toEqual(["client", "sharing", "sync"]);
		const names = await toolNames(client);
		expect(names).not.toContain("list_projects");
		expect(names).not.toContain("list_workspaces");
		await call(client, "enable_toolset", { toolset: "sharing" });
		expect(await toolNames(client)).toEqual(
			expect.arrayContaining(["list_workspaces", "get_collection_public_link"]),
		);
	});

	it("are not offered to a mock-only token", async () => {
		const client = await connect("mock:read mock:write");
		expect(await toolsetNames(client)).not.toContain("sharing");
		const enable = await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "sharing" },
		});
		expect(enable.isError).toBe(true);
	});

	it("read workspaces and a collection's public link with client:read", async () => {
		const writer = await connect("client:read client:write");
		const query = "?toolsets=client,sharing";
		const reader = await connect("client:read", query);
		const workspaces = await call(reader, "list_workspaces", {});
		const items = workspaces.items as { id: string }[];
		const workspaceId = items[0]?.id;
		expect(workspaceId).toEqual(expect.any(String));
		const collection = await call(writer, "create_collection", {
			workspaceId,
			name: "Shared",
		});
		const link = await call(reader, "get_collection_public_link", {
			collectionId: collection.id,
		});
		expect(link).toEqual({ link: null });
		await expect(
			reader.callTool({
				name: "enable_collection_public_link",
				arguments: { collectionId: collection.id, dry_run: true },
			}),
		).rejects.toThrow(/insufficient_scope|client:write/);
	});
});

describe("giving someone access needs client:share", () => {
	it("is refused by step-up without it, runs with it, and is never advertised", async () => {
		const query = "?toolsets=client,sharing";
		const writer = await connect("client:read client:write", query);
		const created = await call(writer, "create_workspace", { name: "Team" });
		const workspaceId = String(created.id);
		await expect(
			writer.callTool({
				name: "create_workspace_invite_link",
				arguments: { workspaceId, role: "viewer" },
			}),
		).rejects.toThrow(
			/Insufficient scope: required "client:write client:share"/,
		);
		const sharer = await connect(
			"client:read client:write client:share",
			query,
		);
		const invite = await call(sharer, "create_workspace_invite_link", {
			workspaceId,
			role: "viewer",
		});
		expect(String(invite.inviteLink)).toContain("/workspace-invite/");
		const metadata = await fetch(
			`${running.url}/.well-known/oauth-protected-resource/mcp`,
		);
		const body = (await metadata.json()) as { scopes_supported: string[] };
		expect(body.scopes_supported).not.toContain("client:share");
	});
});
