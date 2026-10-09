import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
	type McpHttpHandler,
	createMcpHandler,
} from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { USER_SCOPE } from "../../http/require-auth.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { deletedWidgets } from "./__fixtures__/mcp-fixture-operations.js";
import { fixtureOperations } from "./__fixtures__/mcp-fixture-operations.js";
import {
	ALL_FIXTURE_SCOPES,
	textJson,
} from "./__fixtures__/mcp-test-client.js";
import { createConfirmTokenService } from "./confirm-token.js";
import { createOperationMcpServer } from "./operation-mcp-server.js";
import { createMemoryToolsetSelectionStore } from "./toolset-selection.js";

let handler: McpHttpHandler | undefined;

afterEach(async () => {
	await handler?.close();
	handler = undefined;
});

/**
 * Streamable HTTP on protocol 2026-07-28: the SDK builds a new server per
 * request, so toolset choices and confirm tokens must live outside it.
 */
async function connectOverHttp(): Promise<Client> {
	const store = createMemoryToolsetSelectionStore();
	const confirmTokens = createConfirmTokenService();
	const { logger } = captureLogs();
	const mcp = createMcpHandler(
		() =>
			createOperationMcpServer({
				serverInfo: { name: "localman-test", version: "0.0.0" },
				operations: fixtureOperations,
				caller: {
					auth: { subjectId: "user-1", scopes: [USER_SCOPE] },
					tokenScopes: ALL_FIXTURE_SCOPES,
					clientIp: null,
				},
				selection: { store, principalKey: "user-1:test-client" },
				confirmTokens,
				logger,
				onToolsChanged: () => mcp.notify.toolsChanged(),
			}),
		{ legacy: "reject" },
	);
	handler = mcp;
	const client = new Client(
		{ name: "test", version: "0.0.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	const transport = new StreamableHTTPClientTransport(
		new URL("http://localman.test/mcp"),
		{ fetch: (url, init) => mcp.fetch(new Request(url, init)) },
	);
	await client.connect(transport);
	return client;
}

describe("operation MCP server over Streamable HTTP (2026-07-28)", () => {
	it("keeps enable_toolset across stateless requests", async () => {
		const client = await connectOverHttp();
		const before = await client.listTools();
		expect(before.tools.map((t) => t.name)).not.toContain("list_audits");

		await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "admin" },
		});
		const after = await client.listTools({}, { cacheMode: "bypass" });
		expect(after.tools.map((t) => t.name)).toContain("list_audits");
	});

	it("confirms a destructive call across requests", async () => {
		deletedWidgets.length = 0;
		const client = await connectOverHttp();
		const preview = await client.callTool({
			name: "delete_widget_tree",
			arguments: { widgetId: "w9", dry_run: true },
		});
		const body = textJson(preview);
		const token =
			typeof body === "object" && body !== null && "confirm_token" in body
				? body.confirm_token
				: undefined;
		expect(token).toEqual(expect.any(String));

		const done = await client.callTool({
			name: "delete_widget_tree",
			arguments: { widgetId: "w9", confirm_token: token },
		});
		expect(done.structuredContent).toEqual({ dryRun: false, removed: 3 });
		expect(deletedWidgets).toEqual(["w9"]);
	});
});
