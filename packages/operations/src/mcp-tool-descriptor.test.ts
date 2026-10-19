import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	createResource,
	deleteProject,
	downloadExtension,
	getResource,
} from "./__fixtures__/sample-operations.js";
import { defineOperation } from "./define-operation.js";
import {
	mcpScopesOf,
	toMcpToolDescriptor,
	toolNameOf,
} from "./mcp-tool-descriptor.js";
import { type McpExtraScope, scopeAreaOf } from "./types.js";

describe("toMcpToolDescriptor", () => {
	it("derives snake_case tool names from operation ids", () => {
		expect(toolNameOf("mock.listResources")).toBe("list_resources");
		expect(toolNameOf("mock-advanced.setRule2Status")).toBe("set_rule2_status");
	});

	it("builds a descriptor with JSON Schema input and hints", () => {
		const tool = toMcpToolDescriptor(getResource);
		expect(tool).not.toBeNull();
		expect(tool?.name).toBe("get_resource");
		expect(tool?.description).toBe(
			"Get one mock resource\n\nReturns a resource of a mock project.",
		);
		expect(tool?.toolset).toBe("mock");
		expect(tool?.dryRun).toBe(false);
		expect(tool?.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
		});
		expect(tool?.inputSchema).toMatchObject({
			type: "object",
			required: ["projectId", "resourceId"],
			properties: {
				projectId: { type: "string", minLength: 1 },
				expand: { type: "string", enum: ["schema", "none"] },
			},
		});
		expect(tool?.inputSchema).not.toHaveProperty("$schema");
	});

	it("describes inputs as the caller sends them, keeping defaults optional", () => {
		const tool = toMcpToolDescriptor(createResource);
		expect(tool?.inputSchema.required).toEqual(["projectId", "name"]);
		expect(tool?.inputSchema.properties?.count).toMatchObject({ default: 10 });
	});

	it("marks destructive tools and their dry-run support", () => {
		const tool = toMcpToolDescriptor(deleteProject);
		expect(tool?.annotations.destructiveHint).toBe(true);
		expect(tool?.dryRun).toBe(true);
		expect(tool?.requiresConfirmation).toBe(true);
		expect(toMcpToolDescriptor(createResource)?.requiresConfirmation).toBe(
			false,
		);
		// Destructive alone does not demand a confirm token.
		const direct = toMcpToolDescriptor({
			...deleteProject,
			requiresConfirmation: false,
		});
		expect(direct?.annotations.destructiveHint).toBe(true);
		expect(direct?.dryRun).toBe(true);
		expect(direct?.requiresConfirmation).toBe(false);
	});

	it("describes the output and the token scopes the tool needs", () => {
		const read = toMcpToolDescriptor(getResource);
		expect(read?.operationId).toBe("mock.getResource");
		expect(read?.outputSchema).toMatchObject({
			type: "object",
			required: ["id", "projectId", "name"],
		});
		expect(read?.scopes).toEqual(["mock:read"]);
		expect(toMcpToolDescriptor(deleteProject)?.scopes).toEqual([
			"client:write",
		]);
		expect(
			mcpScopesOf({
				toolset: "users",
				annotations: { readOnly: false, destructive: false, idempotent: false },
				createsCredential: true,
			}),
		).toEqual(["users:write", "credentials:write"]);
	});

	it("emits no tool for exempt operations", () => {
		expect(toMcpToolDescriptor(downloadExtension)).toBeNull();
	});
});

describe("MCP scopes from the toolset and the operation", () => {
	const write = { readOnly: false, destructive: false, idempotent: false };
	const sendLike = (mcpScope?: McpExtraScope) =>
		defineOperation({
			id: "client.sendThing",
			method: "POST",
			path: "/things",
			summary: "Send a thing",
			input: z.object({}),
			output: z.object({}),
			scopes: ["user"],
			annotations: write,
			toolset: "client",
			mcp: true,
			...(mcpScope ? { mcpScope } : {}),
			handler: () => ({}),
		});

	it("adds the operation's mcpScope after the toolset scope", () => {
		expect(toMcpToolDescriptor(sendLike("client:send"))?.scopes).toEqual([
			"client:write",
			"client:send",
		]);
		expect(toMcpToolDescriptor(sendLike())?.scopes).toEqual(["client:write"]);
	});

	it("refuses an unknown mcpScope or one on an operation without a tool", () => {
		const base = sendLike("client:send");
		// A registry loaded untyped can carry any string; the cast mimics it.
		const unknownScope: unknown = "client:everything";
		expect(() =>
			defineOperation({
				...base,
				mcpScope: unknownScope as McpExtraScope,
			}),
		).toThrow(/`mcpScope` must be one of client:send/);
		expect(() =>
			defineOperation({ ...base, mcp: { exempt: "browser only" } }),
		).toThrow(/`mcpScope` needs an MCP tool/);
	});

	it("gives sharing and public tools the client:* scopes", () => {
		expect(scopeAreaOf("sharing")).toBe("client");
		expect(scopeAreaOf("public")).toBe("client");
		expect(scopeAreaOf("collab")).toBe("collab");
		expect(
			mcpScopesOf({
				toolset: "sharing",
				annotations: write,
				createsCredential: true,
			}),
		).toEqual(["client:write", "credentials:write"]);
		expect(
			mcpScopesOf({
				toolset: "public",
				annotations: { ...write, readOnly: true },
				createsCredential: false,
			}),
		).toEqual(["client:read"]);
	});
});
