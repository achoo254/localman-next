import { describe, expect, it } from "vitest";
import { USER_SCOPE } from "../../http/require-auth.js";
import {
	ALL_FIXTURE_SCOPES,
	connectTestClient,
	textJson,
} from "./__fixtures__/mcp-test-client.js";

describe("createOperationMcpServer: tools", () => {
	it("exposes every non-exempt operation of the default toolsets", async () => {
		const { client } = await connectTestClient();
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name).sort()).toEqual([
			"create_widget",
			"delete_widget_tree",
			"enable_toolset",
			"list_toolsets",
			"list_widgets",
			"lock_widget",
			"preview_widget_colors",
			"reset_widget",
		]);
	});

	it("advertises JSON Schema input/output, hints and required scopes", async () => {
		const { client } = await connectTestClient();
		const { tools } = await client.listTools();
		const list = tools.find((tool) => tool.name === "list_widgets");
		expect(list?.inputSchema).toEqual({
			type: "object",
			properties: {
				limit: { default: 10, type: "integer", minimum: 1, maximum: 50 },
			},
		});
		expect(list?.outputSchema).toMatchObject({
			type: "object",
			required: ["owner", "limit"],
		});
		expect(list?.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
		expect(list?._meta).toMatchObject({
			"localman/toolset": "mock",
			"localman/scopes": ["mock:read"],
		});

		const remove = tools.find((tool) => tool.name === "delete_widget_tree");
		expect(remove?.annotations?.destructiveHint).toBe(true);
		expect(remove?.inputSchema.properties).toHaveProperty("dry_run");
		expect(remove?.inputSchema.properties).toHaveProperty("confirm_token");
		expect(remove?.description).toContain("dry_run=true");

		const direct = tools.find((tool) => tool.name === "reset_widget");
		expect(direct?.inputSchema.properties).toHaveProperty("dry_run");
		expect(direct?.inputSchema.properties).not.toHaveProperty("confirm_token");
	});

	it("runs the handler like REST and returns structured output", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "list_widgets",
			arguments: { limit: 5 },
		});
		expect(result.structuredContent).toEqual({ owner: "user-1", limit: 5 });
		expect(textJson(result)).toEqual({ owner: "user-1", limit: 5 });
	});

	it("requires credentials:write for tools that mint a credential", async () => {
		const scopes = ALL_FIXTURE_SCOPES.filter((s) => s !== "credentials:write");
		const { client } = await connectTestClient({
			toolsets: ["users"],
			caller: {
				auth: { subjectId: "user-1", scopes: [USER_SCOPE] },
				tokenScopes: scopes,
				clientIp: null,
			},
		});
		const { tools } = await client.listTools();
		const tool = tools.find((t) => t.name === "create_access_key");
		expect(tool?._meta?.["localman/scopes"]).toEqual([
			"users:write",
			"credentials:write",
		]);
		const refused = await client.callTool({
			name: "create_access_key",
			arguments: { label: "ci" },
		});
		expect(refused.isError).toBe(true);
		expect(textJson(refused)).toMatchObject({
			error: {
				code: "INSUFFICIENT_SCOPE",
				details: { scopes: "credentials:write" },
			},
		});

		const { client: allowed } = await connectTestClient({
			toolsets: ["users"],
		});
		const created = await allowed.callTool({
			name: "create_access_key",
			arguments: { label: "ci" },
		});
		expect(created.structuredContent).toEqual({
			id: "key_1",
			secret: "shown-once",
		});
	});
});

describe("createOperationMcpServer: errors", () => {
	it("maps OperationError to a tool error with code and details", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "lock_widget",
			arguments: { widgetId: "w1" },
		});
		expect(result.isError).toBe(true);
		expect(textJson(result)).toEqual({
			error: {
				code: "WIDGET_LOCKED",
				message: "Widget is already locked",
				details: { widgetId: "w1" },
			},
		});
	});

	it("validates input with the operation schema (VALIDATION_ERROR)", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "create_widget",
			arguments: { name: "" },
		});
		expect(result.isError).toBe(true);
		expect(textJson(result)).toMatchObject({
			error: { code: "VALIDATION_ERROR", details: [{ path: "name" }] },
		});
	});

	it("hides unexpected errors and logs them", async () => {
		const { client, logs } = await connectTestClient();
		const result = await client.callTool({
			name: "lock_widget",
			arguments: { widgetId: "crash" },
		});
		expect(textJson(result)).toEqual({
			error: { code: "INTERNAL_ERROR", message: "Internal server error" },
		});
		expect(JSON.stringify(result)).not.toContain("hunter2");
		expect(logs.entries("MCP tool call failed")).toHaveLength(1);
	});

	it("checks auth, token scopes and policy before the handler", async () => {
		const { client: anonymous } = await connectTestClient({
			caller: { auth: null, tokenScopes: ALL_FIXTURE_SCOPES, clientIp: null },
		});
		const unauthenticated = await anonymous.callTool({
			name: "list_widgets",
			arguments: {},
		});
		expect(textJson(unauthenticated)).toMatchObject({
			error: { code: "UNAUTHENTICATED" },
		});

		const { client: readOnly } = await connectTestClient({
			caller: {
				auth: { subjectId: "user-1", scopes: [USER_SCOPE] },
				tokenScopes: ["mock:read"],
				clientIp: null,
			},
		});
		const noWrite = await readOnly.callTool({
			name: "create_widget",
			arguments: { name: "a" },
		});
		expect(textJson(noWrite)).toMatchObject({
			error: { code: "INSUFFICIENT_SCOPE" },
		});

		const { client } = await connectTestClient();
		const refused = await client.callTool({
			name: "delete_widget_tree",
			arguments: { widgetId: "not-mine", dry_run: true },
		});
		expect(textJson(refused)).toMatchObject({ error: { code: "FORBIDDEN" } });
	});

	it("refuses dry_run on a tool without a preview instead of writing", async () => {
		const { client } = await connectTestClient();
		const result = await client.callTool({
			name: "create_widget",
			arguments: { name: "a", dry_run: true },
		});
		expect(textJson(result)).toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});
});
