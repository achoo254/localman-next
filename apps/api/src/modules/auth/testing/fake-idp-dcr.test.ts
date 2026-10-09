import { createHash, randomBytes } from "node:crypto";
import { type Server, createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { DCR_DEFAULT_SCOPES } from "./fake-idp-mcp.js";
import { startFakeIdp } from "./fake-idp.js";

const LOCALMAN = "https://localman.test";
const REDIRECT_URI = "http://127.0.0.1:9/callback";

const server: Server = createServer();
let issuer = "";
let endpoints = { registration: "", authorization: "" };
let scopesSupported: readonly string[] = [];

const discoverySchema = z.object({
	registration_endpoint: z.string(),
	authorization_endpoint: z.string(),
	scopes_supported: z.array(z.string()),
});
const registeredSchema = z.object({ client_id: z.string(), scope: z.string() });
const errorSchema = z.object({ error: z.string() });

beforeAll(async () => {
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	issuer = `http://127.0.0.1:${address.port}`;
	await startFakeIdp({
		server,
		issuer,
		clientSecret: "fake-idp-dcr-secret",
		localmanPublicUrl: LOCALMAN,
		backchannelLogoutUri: `${LOCALMAN}/auth/backchannel-logout`,
		account: {
			sub: "acc_dcr",
			username: "dcr",
			email: "dcr@example.test",
			name: "DCR",
		},
	});
	const discovery = discoverySchema.parse(
		await (await fetch(`${issuer}/.well-known/openid-configuration`)).json(),
	);
	endpoints = {
		registration: discovery.registration_endpoint,
		authorization: discovery.authorization_endpoint,
	};
	scopesSupported = discovery.scopes_supported;
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Registers an MCP client the way the MCP SDK does (public, PKCE). */
function register(scope?: string): Promise<Response> {
	return fetch(endpoints.registration, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_name: "DCR policy test agent",
			redirect_uris: [REDIRECT_URI],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
			...(scope === undefined ? {} : { scope }),
		}),
	});
}

async function registeredScope(scope?: string): Promise<string[]> {
	const response = await register(scope);
	expect(response.status).toBe(201);
	return registeredSchema.parse(await response.json()).scope.split(" ");
}

async function registerClient(scope: string): Promise<string> {
	const response = await register(scope);
	expect(response.status).toBe(201);
	return registeredSchema.parse(await response.json()).client_id;
}

/** Where the IdP sends the browser for an authorization request. */
async function authorize(clientId: string, scope: string): Promise<URL> {
	const verifier = randomBytes(32).toString("base64url");
	const url = new URL(endpoints.authorization);
	url.search = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		state: "state-1",
		scope,
		resource: `${LOCALMAN}/mcp`,
		prompt: "consent",
	}).toString();
	const response = await fetch(url, { redirect: "manual" });
	const location = response.headers.get("location");
	if (location === null) throw new Error(`No redirect (${response.status})`);
	return new URL(location, issuer);
}

describe("fake IdP dynamic client registration (as auth.hoandat.com)", () => {
	it("advertises offline_access, so the MCP SDK asks for it", () => {
		expect(scopesSupported).toContain("offline_access");
		expect(scopesSupported).toContain("credentials:write");
	});

	it("drops offline_access from the registered scope instead of refusing", async () => {
		expect(
			await registeredScope("mock:read mock:write offline_access"),
		).toEqual(["mock:read", "mock:write"]);
	});

	it("gives the Localman scopes without credentials:write when none is registered", async () => {
		const scopes = await registeredScope();
		expect(scopes).toEqual([...DCR_DEFAULT_SCOPES]);
		expect(scopes).not.toContain("credentials:write");
		expect(await registeredScope("offline_access")).toEqual([
			...DCR_DEFAULT_SCOPES,
		]);
	});

	it("holds credentials:write only when registered by name", async () => {
		expect(await registeredScope("mock:read credentials:write")).toEqual([
			"mock:read",
			"credentials:write",
		]);
	});

	it.each(["mock:read admin:all", "openid mock:read", "telegram"])(
		"refuses a scope outside the MCP resource (%s)",
		async (scope) => {
			const response = await register(scope);
			expect(response.status).toBe(400);
			expect(errorSchema.parse(await response.json()).error).toBe(
				"invalid_client_metadata",
			);
		},
	);

	it("ignores offline_access in the authorization request", async () => {
		const clientId = await registerClient("mock:read mock:write");
		const next = await authorize(
			clientId,
			"mock:read mock:write offline_access",
		);
		expect(next.origin).toBe(issuer);
		expect(next.pathname).toMatch(/^\/interaction\//);
	});

	it("refuses credentials:write at authorization when it was not registered", async () => {
		const clientId = await registerClient("mock:read mock:write");
		const next = await authorize(clientId, "mock:read credentials:write");
		expect(next.href.startsWith(REDIRECT_URI)).toBe(true);
		expect(next.searchParams.get("error")).toBe("invalid_scope");
	});
});
