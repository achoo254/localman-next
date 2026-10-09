import { FREE_LIMITS } from "@localman/shared";
import { afterEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { UsageCounterModel, yyyymmOf } from "../billing/usage-counter-model.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	generate,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import {
	type ListeningApp,
	connectMockMcp,
	errorCodeOf,
	listen,
} from "./__fixtures__/mock-mcp-test-client.js";
import { McpTokenModel } from "./mcp-token-model.js";

const kit = useMockTestKit();
let server: ListeningApp | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
});

const tokenPath = (projectId: string, suffix = "") =>
	`/projects/${projectId}/mcp-token${suffix}`;

async function usersProject() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	server = await listen(kit.client(project.secret).app);
	return {
		...project,
		users,
		url: `${server.origin}/m/${project.secret}/mcp`,
	};
}

/** A raw MCP POST: enough to see the 401 before any MCP processing. */
function postMcp(url: string, token?: string) {
	return fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
	});
}

async function requireToken(projectId: string): Promise<string> {
	const res = await as(OWNER).send("put", tokenPath(projectId), {
		required: true,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body.issuedToken;
}

describe("MCP token settings", () => {
	it("creates the token once and never shows it again", async () => {
		const { id } = await usersProject();
		const initial = await as(OWNER).get(tokenPath(id));
		expect(initial.body).toEqual({ required: false, token: null });

		const token = await requireToken(id);
		expect(token).toMatch(/^lmmcp_[A-Za-z0-9_-]{43}$/);
		const status = await as(OWNER).get(tokenPath(id));
		expect(status.body).toEqual({
			required: true,
			token: { last4: token.slice(-4), createdAt: expect.any(String) },
		});
		expect(JSON.stringify(status.body)).not.toContain(token);
		const stored = await McpTokenModel.findOne().lean();
		expect(JSON.stringify(stored)).not.toContain(token);

		// Off keeps the token; on again restores it without a new one.
		await as(OWNER).send("put", tokenPath(id), { required: false });
		const again = await as(OWNER).send("put", tokenPath(id), {
			required: true,
		});
		expect(again.body.issuedToken).toBeUndefined();
		expect(again.body.token.last4).toBe(token.slice(-4));
	});

	it("is for the owner only", async () => {
		const { id } = await usersProject();
		const stranger = await as("acc_stranger").get(tokenPath(id));
		expect(stranger.status).toBe(404);
	});

	it("is removed with the project", async () => {
		const { id } = await usersProject();
		await requireToken(id);
		const deleted = await as(OWNER).send("delete", `/projects/${id}`);
		expect(deleted.status).toBe(200);
		expect(await McpTokenModel.countDocuments()).toBe(0);
	});
});

describe("Bearer token on the MCP endpoint", () => {
	it("answers 401 without the token, and REST is unaffected", async () => {
		const { id, secret, url } = await usersProject();
		const token = await requireToken(id);

		const missing = await postMcp(url);
		expect(missing.status).toBe(401);
		expect(missing.headers.get("www-authenticate")).toMatch(/^Bearer /);
		expect((await missing.json()).error.code).toBe("UNAUTHENTICATED");
		const wrong = await postMcp(url, `${token}x`);
		expect(wrong.status).toBe(401);
		expect(wrong.headers.get("www-authenticate")).toContain(
			'error="invalid_token"',
		);

		const client = await connectMockMcp(url, { token });
		const tools = await client.listTools();
		expect(tools.tools.map((t) => t.name)).toContain("list_users");
		expect((await kit.client(secret).get("/users")).status).toBe(200);
	});

	it("stops accepting the old token after a rotation", async () => {
		const { id, url } = await usersProject();
		const old = await requireToken(id);
		const preview = await as(OWNER).send(
			"post",
			tokenPath(id, "/rotate?dryRun=true"),
		);
		expect(preview.body).toMatchObject({ dryRun: true, required: true });
		expect(preview.body.issuedToken).toBeUndefined();
		expect((await postMcp(url, old)).status).not.toBe(401);

		const rotated = await as(OWNER).send("post", tokenPath(id, "/rotate"));
		const fresh: string = rotated.body.issuedToken;
		expect(fresh).not.toBe(old);
		expect(rotated.body).toMatchObject({ dryRun: false, required: true });
		expect((await postMcp(url, old)).status).toBe(401);
		const client = await connectMockMcp(url, { token: fresh });
		expect((await client.listTools()).tools.length).toBeGreaterThan(0);
	});
});

describe("limits of the MCP endpoint", () => {
	it("answers MONTHLY_QUOTA_EXCEEDED once the owner's quota is used", async () => {
		const { url } = await usersProject();
		await UsageCounterModel.create({
			ownerSub: OWNER,
			yyyymm: yyyymmOf(new Date()),
			mockRequests: FREE_LIMITS.mockRequestsPerMonth ?? 0,
		});
		const client = await connectMockMcp(url);
		const result = await client.callTool({ name: "list_users", arguments: {} });
		expect(errorCodeOf(result)).toBe("MONTHLY_QUOTA_EXCEEDED");
	});

	it("refuses a resource named mcp, and serves MCP over an older one", async () => {
		const { id, secret, url, users } = await usersProject();
		const refused = await as(OWNER).send("post", resourcesPath(id), {
			name: "mcp",
		});
		expect(refused.status).toBe(400);
		expect(refused.body.error.code).toBe("VALIDATION_ERROR");

		// Stored before the rule: `/mcp` is the endpoint, records stay REST.
		expect((await generate(OWNER, id, users.id, 1)).status).toBe(200);
		await ResourceModel.updateOne({ name: "users" }, { $set: { name: "mcp" } });
		const client = await connectMockMcp(url);
		expect((await client.listTools()).tools.map((t) => t.name)).toContain(
			"list_mcp",
		);
		expect((await kit.client(secret).get("/mcp/1")).status).toBe(200);
	});
});
