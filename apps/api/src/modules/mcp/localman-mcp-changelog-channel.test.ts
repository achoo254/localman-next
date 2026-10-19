import type { Client } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import {
	TEST_PUBLIC_URL,
	type TestIdp,
	createTestIdp,
} from "./testing/idp-token-signer.js";
import {
	COOKIE_USER,
	type RunningApp,
	SESSION_COOKIE,
	connectMcpClient,
	createMcpTestApp,
	listenOnLoopback,
} from "./testing/localman-mcp-harness.js";
import { structuredOf } from "./testing/tool-structured-content.js";

useDashboardTestDb(() => ({
	publicUrl: TEST_PUBLIC_URL,
	mockBaseDomain: "mock.test",
}));

const AGENT_USER = "acc_agent_changelog";

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

async function agent(): Promise<Client> {
	const token = await idp.sign({
		scope: "client:read client:write",
		sub: AGENT_USER,
	});
	const client = await connectMcpClient(
		running.url,
		token,
		"modern",
		"?toolsets=client,sharing",
	);
	clients.push(client);
	return client;
}

async function call(client: Client, name: string, args: object) {
	return structuredOf(await client.callTool({ name, arguments: { ...args } }));
}

/** The web app's REST API on the same server, as the cookie user. */
async function rest(method: string, path: string, body?: object) {
	const res = await fetch(`${running.url}/api/v1${path}`, {
		method,
		headers: {
			cookie: SESSION_COOKIE,
			origin: TEST_PUBLIC_URL,
			accept: "application/json",
			...(body ? { "content-type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	return {
		status: res.status,
		body: (await res.json()) as Record<string, unknown>,
	};
}

type Session = { changes: { viaMcp: boolean }[] };

const personalOf = (listed: Record<string, unknown>): string => {
	const items = listed.items as { id: string; type: string }[];
	return items.find((ws) => ws.type === "personal")?.id ?? "";
};

describe("changes made through Localman MCP", () => {
	it("are marked via MCP in the changelog; web changes are not", async () => {
		const client = await agent();
		const ws = personalOf(await call(client, "list_workspaces", {}));
		const created = await call(client, "create_collection", {
			workspaceId: ws,
			name: "Agent API",
		});
		const id = String(created.id);
		await call(client, "update_collection", {
			collectionId: id,
			description: "written by an agent",
		});
		const log = await call(client, "get_collection_changelog", {
			collectionId: id,
		});
		const sessions = log.sessions as Session[];
		expect(sessions.length).toBeGreaterThan(0);
		for (const session of sessions) {
			for (const change of session.changes) expect(change.viaMcp).toBe(true);
		}

		// The same server, through the web app's routes: no MCP mark leaks.
		const listed = await rest("GET", "/workspaces");
		const mine = personalOf(listed.body);
		const web = await rest("POST", `/workspaces/${mine}/collections`, {
			name: "Web API",
		});
		expect(web.status, JSON.stringify(web.body)).toBe(201);
		const edit = await rest("PATCH", `/collections/${String(web.body.id)}`, {
			description: "written in the browser",
		});
		expect(edit.status).toBe(200);
		const webLog = await rest(
			"GET",
			`/collections/${String(web.body.id)}/changelog`,
		);
		const webChanges = (webLog.body.sessions as Session[]).flatMap(
			(session) => session.changes,
		);
		expect(webChanges.length).toBeGreaterThan(0);
		expect(webChanges.every((change) => change.viaMcp === false)).toBe(true);
		expect(COOKIE_USER).not.toBe(AGENT_USER);
	});
});
