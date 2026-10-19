import type { Client } from "@modelcontextprotocol/client";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ADA, VIC } from "../access/testing/access-fixture.js";
import { readUsage } from "../billing/usage-counter-model.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import {
	testKeyring,
	useVariableKeyring,
} from "../environments/testing/environment-fixture.js";
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

const SECRET = "mcp-env-s3cret-91a2";
const ALL = "client:read client:write client:send";

let idp: TestIdp;
let running: RunningApp;
const clients: Client[] = [];
beforeEach(() => {
	useVariableKeyring(testKeyring());
});
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

async function agentFor(sub: string, scope = ALL): Promise<Client> {
	const token = await idp.sign({ scope, sub });
	const client = await connectMcpClient(running.url, token, "modern");
	clients.push(client);
	return client;
}

async function call(client: Client, name: string, args: object) {
	return structuredOf(await client.callTool({ name, arguments: { ...args } }));
}

describe("client tools through Localman MCP", () => {
	it("never hands an agent an environment's secret value", async () => {
		const ws = (await teamOfThree()).toHexString();
		const agent = await agentFor(ADA);
		const env = await call(agent, "create_environment", {
			workspaceId: ws,
			name: "Staging",
			variables: [
				{ key: "token", type: "secret", enabled: true, sharedValue: SECRET },
			],
		});
		expect(JSON.stringify(env)).not.toContain(SECRET);
		const read = await call(agent, "get_environment", {
			environmentId: String(env.id),
		});
		expect(JSON.stringify(read)).not.toContain(SECRET);
		// The agent wrote it: the browser of the same user reads it back.
		const web = await as(ADA).get(`/environments/${String(env.id)}`);
		expect(JSON.stringify(web.body)).toContain(SECRET);
	});

	it("refuses a write tool to a Viewer of the collection", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders API" });
		const viewer = await agentFor(VIC);
		const read = await call(viewer, "get_collection", { collectionId: id });
		expect(read.name).toBe("Orders API");
		const write = await viewer.callTool({
			name: "update_collection",
			arguments: { collectionId: id, description: "by a viewer" },
		});
		expect(write.isError).toBe(true);
		expect(JSON.stringify(write.content)).toMatch(/FORBIDDEN|403/);
		const after = await as(ADA).get(`/collections/${id}`);
		expect(after.body.description).not.toBe("by a viewer");
	});

	it("counts one proxy request per send_request", async () => {
		const agent = await agentFor(ADA);
		const before = (await readUsage(ADA)).proxyRequests;
		const sent = await agent.callTool({
			name: "send_request",
			arguments: {
				method: "GET",
				url: "http://169.254.169.254/latest/meta-data",
				headers: [],
			},
		});
		expect(sent.isError).toBe(true);
		expect((await readUsage(ADA)).proxyRequests).toBe(before + 1);
	});
});
