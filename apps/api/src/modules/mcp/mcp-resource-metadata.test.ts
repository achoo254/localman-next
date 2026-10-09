import { errors } from "jose";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import {
	TEST_ISSUER,
	TEST_PUBLIC_URL,
	TEST_RESOURCE,
	type TestIdp,
	createTestIdp,
} from "./testing/idp-token-signer.js";
import {
	SESSION_COOKIE,
	createMcpTestApp,
} from "./testing/localman-mcp-harness.js";

useDashboardTestDb(() => ({ publicUrl: TEST_PUBLIC_URL }));

const METADATA_URL = `${TEST_PUBLIC_URL}/.well-known/oauth-protected-resource/mcp`;
const INITIALIZE = {
	jsonrpc: "2.0",
	id: 1,
	method: "tools/list",
	params: {},
};

let idp: TestIdp;
let app: ReturnType<typeof createMcpTestApp>;
beforeAll(async () => {
	idp = await createTestIdp();
	app = createMcpTestApp(idp);
});

function postMcp(token?: string) {
	const test = request(app)
		.post("/mcp")
		.set("content-type", "application/json")
		.set("accept", "application/json, text/event-stream");
	return token ? test.set("authorization", `Bearer ${token}`) : test;
}

describe("protected resource metadata (RFC 9728)", () => {
	it.each([
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
	])("GET %s describes the MCP resource and its IdP", async (path) => {
		const res = await request(app).get(path);
		expect(res.status).toBe(200);
		expect(res.headers["access-control-allow-origin"]).toBe("*");
		expect(res.body).toEqual({
			resource: TEST_RESOURCE,
			authorization_servers: [TEST_ISSUER],
			scopes_supported: ["mock:read", "mock:write"],
			bearer_methods_supported: ["header"],
			resource_name: "Localman MCP",
		});
	});
});

describe("Bearer authentication of /mcp", () => {
	it("asks for a token without an error code when none is sent", async () => {
		const res = await postMcp().send(INITIALIZE);
		expect(res.status).toBe(401);
		expect(res.headers["www-authenticate"]).toBe(
			`Bearer resource_metadata="${METADATA_URL}"`,
		);
		expect(res.body.error.code).toBe("UNAUTHENTICATED");
	});

	it.each([
		["a wrong issuer", { issuer: "https://evil.test" }],
		["another audience", { audience: "https://localman.test" }],
		["an expired token", { expiresIn: -120 }],
		["an ID token (typ)", { typ: "JWT" }],
		["a key outside the JWKS", { untrustedKey: true }],
		["a disallowed algorithm (RS256)", { rs256: true }],
	])("refuses %s with invalid_token", async (_label, options) => {
		const res = await postMcp(await idp.sign(options)).send(INITIALIZE);
		expect(res.status).toBe(401);
		const challenge = String(res.headers["www-authenticate"]);
		expect(challenge).toMatch(/^Bearer error="invalid_token"/);
		expect(challenge).toContain(`resource_metadata="${METADATA_URL}"`);
		expect(res.body.error.code).toBe("INVALID_TOKEN");
	});

	it("accepts an audience list that contains the resource", async () => {
		const token = await idp.sign({
			audience: ["https://other.test", TEST_RESOURCE],
		});
		const res = await postMcp(token).send(INITIALIZE);
		expect(res.status).not.toBe(401);
	});

	it("refuses a token without a Localman MCP scope with insufficient_scope", async () => {
		const token = await idp.sign({ scope: "client:read tunnels:read" });
		const res = await postMcp(token).send(INITIALIZE);
		expect(res.status).toBe(403);
		expect(res.headers["www-authenticate"]).toContain(
			'error="insufficient_scope"',
		);
		expect(res.headers["www-authenticate"]).toContain(
			'scope="mock:read mock:write"',
		);
	});

	it("never takes the session cookie instead of a Bearer token", async () => {
		const projects = await request(app)
			.get("/api/v1/projects")
			.set("cookie", SESSION_COOKIE);
		expect(projects.status).toBe(200);
		const res = await postMcp().set("cookie", SESSION_COOKIE).send(INITIALIZE);
		expect(res.status).toBe(401);
	});

	it("is not subject to the dashboard's CSRF origin check, but refuses foreign browser origins", async () => {
		const token = await idp.sign();
		const foreign = await postMcp(token)
			.set("origin", "https://evil.test")
			.send(INITIALIZE);
		expect(foreign.status).toBe(403);
		expect(foreign.body.error.code).toBe("ORIGIN_REJECTED");
		const noOrigin = await postMcp(token).send(INITIALIZE);
		expect(noOrigin.status).not.toBe(403);
	});

	it("answers 400 for an unknown toolset in ?toolsets=", async () => {
		const res = await request(app)
			.post("/mcp?toolsets=mock,bogus")
			.set("authorization", `Bearer ${await idp.sign()}`)
			.set("content-type", "application/json")
			.send(INITIALIZE);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("answers 503 AUTH_UNAVAILABLE when the IdP serves a malformed JWKS", async () => {
		const broken = createMcpTestApp(idp, {
			keys: {
				issuer: async () => TEST_ISSUER,
				jwks: async () => async () => {
					throw new errors.JWKSInvalid("JSON Web Key Set malformed");
				},
			},
		});
		const res = await request(broken)
			.post("/mcp")
			.set("authorization", `Bearer ${await idp.sign()}`)
			.set("content-type", "application/json")
			.send(INITIALIZE);
		expect(res.status).toBe(503);
		expect(res.body.error.code).toBe("AUTH_UNAVAILABLE");
	});
});
