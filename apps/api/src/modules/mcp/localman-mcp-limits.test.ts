import { defineOperation } from "@localman/operations";
import type { Client } from "@modelcontextprotocol/client";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	configureRuntime,
	runtimeSettings,
} from "../../config/runtime-settings.js";
import { USER_SCOPE } from "../../http/require-auth.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { UserModel } from "../users/user-model.js";
import { fixtureOperations } from "./__fixtures__/mcp-fixture-operations.js";
import { MAX_SUBSCRIPTIONS_PER_SUBJECT } from "./localman-mcp-limits.js";
import {
	TEST_PUBLIC_URL,
	type TestIdp,
	createTestIdp,
} from "./testing/idp-token-signer.js";
import {
	connectMcpClient,
	createMcpTestApp,
	listenOnLoopback,
} from "./testing/localman-mcp-harness.js";

useDashboardTestDb(() => ({ publicUrl: TEST_PUBLIC_URL }));

/** A tool of the `client` toolset, so `enable_toolset` has work to do. */
const pingClient = defineOperation({
	id: "client.pingClient",
	method: "GET",
	path: "/client/ping",
	summary: "Ping",
	input: z.object({}),
	output: z.object({ ok: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: () => ({ ok: true }),
});
const OPERATIONS = [...fixtureOperations, pingClient];
const SCOPE = "mock:read mock:write client:read";
const TOOLS_LIST = { jsonrpc: "2.0", id: 1, method: "tools/list" };

let idp: TestIdp;
const clients: Client[] = [];
const closers: (() => Promise<void>)[] = [];
beforeAll(async () => {
	idp = await createTestIdp();
});
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
	await Promise.all(closers.splice(0).map((close) => close()));
	vi.restoreAllMocks();
});

function post(body: unknown, token: string) {
	return request(createMcpTestApp(idp, { operations: OPERATIONS }))
		.post("/mcp")
		.set("authorization", `Bearer ${token}`)
		.set("content-type", "application/json")
		.set("accept", "application/json, text/event-stream")
		.send(JSON.stringify(body));
}

/** Clients of `sub` on one running app, with `?toolsets=mock`. */
async function runningApp() {
	const running = await listenOnLoopback(
		createMcpTestApp(idp, { operations: OPERATIONS }),
	);
	closers.push(() => running.close());
	return async (sub: string) => {
		const token = await idp.sign({ sub, scope: SCOPE });
		const client = await connectMcpClient(
			running.url,
			token,
			"modern",
			"?toolsets=mock",
		);
		clients.push(client);
		return client;
	};
}

describe("Localman MCP limits", () => {
	it("refuses a JSON-RPC batch with 400", async () => {
		const res = await post([TOOLS_LIST, TOOLS_LIST], await idp.sign());
		expect(res.status).toBe(400);
		expect(JSON.parse(res.text)).toMatchObject({
			jsonrpc: "2.0",
			id: null,
			error: { code: -32600 },
		});
	});

	it("rate-limits requests per subject with 429 and Retry-After", async () => {
		await startClearOfRateWindowEdge(60 * 60_000);
		configureRuntime({
			...runtimeSettings(),
			localmanMcpRateLimit: { max: 2, windowMs: 60 * 60_000 },
		});
		const token = await idp.sign({ sub: "acc_busy" });
		const statuses = [];
		for (let i = 0; i < 3; i += 1) statuses.push(await post(TOOLS_LIST, token));
		expect(statuses.slice(0, 2).map((res) => res.status)).not.toContain(429);
		const refused = statuses[2];
		expect(refused?.status).toBe(429);
		expect(Number(refused?.headers["retry-after"])).toBeGreaterThan(0);
		expect(JSON.parse(refused?.text ?? "{}")).toMatchObject({
			error: { code: "RATE_LIMITED" },
		});
		const other = await post(TOOLS_LIST, await idp.sign({ sub: "acc_calm" }));
		expect(other.status).not.toBe(429);
	});

	it("creates the user row once per subject, not on every request", async () => {
		const upsert = vi.spyOn(UserModel, "updateOne");
		const token = await idp.sign({ sub: "acc_cached" });
		await post(TOOLS_LIST, token);
		await post(TOOLS_LIST, token);
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(await UserModel.countDocuments({ sub: "acc_cached" })).toBe(1);
	});

	it("caps open subscriptions per subject", async () => {
		const connect = await runningApp();
		const busy = await connect("acc_listener");
		const filter = { toolsListChanged: true };
		const open = [];
		for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_SUBJECT; i += 1) {
			open.push(await busy.listen(filter));
		}
		await expect(busy.listen(filter)).rejects.toThrow(
			/Subscription limit reached/,
		);
		const other = await connect("acc_other_listener");
		await expect(other.listen(filter)).resolves.toBeDefined();
		// A closed stream gives its slot back.
		await open[0]?.close();
		await vi.waitFor(async () => {
			await busy.listen(filter);
		});
	});

	it("notifies only the streams of the agent that changed its toolsets", async () => {
		const connect = await runningApp();
		const agent = await connect("acc_agent_a");
		const stranger = await connect("acc_agent_b");
		const seen = { agent: 0, stranger: 0 };
		agent.setNotificationHandler("notifications/tools/list_changed", () => {
			seen.agent += 1;
		});
		stranger.setNotificationHandler("notifications/tools/list_changed", () => {
			seen.stranger += 1;
		});
		await agent.listen({ toolsListChanged: true });
		await stranger.listen({ toolsListChanged: true });

		await agent.callTool({
			name: "enable_toolset",
			arguments: { toolset: "client" },
		});
		await vi.waitFor(() => expect(seen.agent).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(seen.stranger).toBe(0);
	});
});
