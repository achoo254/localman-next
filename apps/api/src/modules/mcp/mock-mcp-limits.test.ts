import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockApp } from "../../mock-server.js";
import { captureLogs } from "../../test-support/log-capture.js";
import {
	MockLimiters,
	type MockRateLimits,
} from "../mock-runtime/rate-limit.js";
import { resolveProject } from "../mock-runtime/resolve-project.js";
import { useMockTestKit } from "../mock-runtime/testing/mock-test-kit.js";
import { ProjectModel } from "../projects/project-model.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import { ResourceModel } from "../resources/resource-model.js";
import { loadResources } from "../resources/resource-store.js";
import { blog } from "./__fixtures__/mock-mcp-blog.js";
import {
	type ListeningApp,
	connectMockMcp,
	errorCodeOf,
	listen,
} from "./__fixtures__/mock-mcp-test-client.js";
import { clearShadowWarnings } from "./mock-mcp-guards.js";
import { createMockMcpServer } from "./mock-mcp-server.js";
import {
	clearMockToolsCache,
	mockToolsFor,
	toMockApiResource,
} from "./mock-mcp-tools-cache.js";

const kit = useMockTestKit();
let server: ListeningApp | undefined;

beforeEach(() => {
	clearMockToolsCache();
	clearShadowWarnings();
});
afterEach(async () => {
	await server?.close();
	server = undefined;
});

const RELAXED: MockRateLimits = {
	perSecret: 100,
	perIp: 100,
	writesPerSecret: 100,
	responseBytesPerSecret: Number.MAX_SAFE_INTEGER,
};

/** The project's MCP server in process, with limits on a frozen clock. */
async function inProcess(secret: string, limits: Partial<MockRateLimits>) {
	const project = await resolveProject(secret);
	if (!project) throw new Error("no project");
	const resources = await loadResources(project.id);
	const apiResources = resources.map(toMockApiResource);
	const mcp = createMockMcpServer(
		{
			secret,
			clientIp: "203.0.113.7",
			project,
			resources,
			apiResources,
			tools: mockToolsFor(secret, project.id.toHexString(), apiResources),
			mockBaseUrl: mockBaseUrlOf(secret, project.prefix),
		},
		{
			logger: captureLogs("silent").logger,
			meter: kit.meter(),
			limiters: new MockLimiters({ ...RELAXED, ...limits }, () => 5_000),
		},
	);
	const client = new Client({ name: "limits-test", version: "0.0.0" });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await mcp.connect(serverSide);
	await client.connect(clientSide);
	return client;
}

const BATCH = Array.from({ length: 5 }, (_, i) => ({
	jsonrpc: "2.0",
	id: i + 1,
	method: "tools/call",
	params: { name: "list_users", arguments: {} },
}));

describe("Hosted Mock MCP limits", () => {
	it("refuses a JSON-RPC batch with 400 before any tool runs", async () => {
		const { id, secret } = await blog();
		const res = await kit
			.client(secret)
			.call("post", "/mcp", BATCH)
			.set("accept", "application/json, text/event-stream")
			.set("mcp-protocol-version", "2025-06-18");
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({
			jsonrpc: "2.0",
			id: null,
			error: { code: -32600 },
		});
		await kit.meter().flush();
		const project = await ProjectModel.findById(id).lean();
		expect(project?.mockRequests ?? 0).toBe(0);
	});

	it("refuses subscriptions/listen: the tool list is fixed per request", async () => {
		const { secret } = await blog();
		server = await listen(kit.client(secret).app);
		const client = await connectMockMcp(`${server.origin}/m/${secret}/mcp`);
		const capabilities = client.getServerCapabilities();
		expect(capabilities?.tools?.listChanged).toBe(false);
		await expect(client.listen({ toolsListChanged: true })).rejects.toThrow(
			/subscriptions\/listen is not supported/,
		);
		await client.close();
	});

	it("admits every tool call by secret, so sequential calls are limited", async () => {
		const { secret } = await blog();
		const client = await inProcess(secret, { perSecret: 2 });
		const codes = [];
		for (let i = 0; i < 3; i += 1) {
			const result = await client.callTool({
				name: "list_users",
				arguments: {},
			});
			codes.push(errorCodeOf(result));
		}
		expect(codes).toEqual([null, null, "RATE_LIMITED"]);
		await client.close();
	});

	it("admits every tool call by client IP and byte budget", async () => {
		const { secret } = await blog();
		const byIp = await inProcess(secret, { perIp: 1 });
		const call = (client: Client) =>
			client.callTool({ name: "get_users", arguments: { id: "1" } });
		expect(errorCodeOf(await call(byIp))).toBeNull();
		expect(errorCodeOf(await call(byIp))).toBe("RATE_LIMITED");
		await byIp.close();

		const byBytes = await inProcess(secret, { responseBytesPerSecret: 10 });
		expect(errorCodeOf(await call(byBytes))).toBeNull();
		expect(errorCodeOf(await call(byBytes))).toBe("RATE_LIMITED");
		await byBytes.close();
	});

	it("warns once that a root resource named mcp is shadowed", async () => {
		const { id, secret } = await blog();
		await ResourceModel.updateOne(
			{ projectId: id, parentId: null, name: "users" },
			{ $set: { name: "mcp" } },
		);
		const logs = captureLogs("warn");
		const app = createMockApp({
			logger: logs.logger,
			usageMeter: kit.meter(),
			trustProxy: "loopback",
			rateLimits: RELAXED,
		});
		server = await listen(app);
		const client = await connectMockMcp(`${server.origin}/m/${secret}/mcp`);
		await client.listTools();
		await client.listTools();
		await client.close();
		const warnings = logs.entries(
			"A root resource named mcp is shadowed by the Hosted Mock MCP endpoint",
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.projectId).toBe(id);
		expect(JSON.stringify(logs.lines)).not.toContain(secret);
	});
});
