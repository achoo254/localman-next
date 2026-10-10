import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createIdpTokenVerifier } from "../../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../../auth/token-authenticator.js";
import type { AuthConfig } from "../../config/auth-config.js";
import { MongoKeyStore } from "../../key-store/mongo-key-store.js";
import { issueAccessToken } from "../../services/access-token-service.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../../test-support/idp-test-keys.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { createApiRouter } from "../create-api-router.js";
import { createLoginPageHandler } from "../render-login-page.js";

useTestDatabase("api-routes");

const config: AuthConfig = {
	mode: "hybrid",
	issuer: TEST_ISSUER,
	audience: TEST_AUDIENCE,
	legacyCutoffMs: Date.parse("2099-01-01T00:00:00Z"),
};

let idp: TestIdp;
let server: http.Server;
let base: string;
let deviceToken: string;

beforeAll(async () => {
	idp = await createTestIdp();
	const authenticator = createTokenAuthenticator({
		config,
		// Mongo is already connected by useTestDatabase; only validate() is used.
		keyStore: new MongoKeyStore("unused"),
		verifier: createIdpTokenVerifier({
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			keys: idp.keys,
		}),
	});
	const app = express();
	app.use("/api", createApiRouter(authenticator));
	app.get("/login", createLoginPageHandler(config));
	server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
	deviceToken = (await issueAccessToken("device:mac", { deviceId: "mac" }))
		.token;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call(
	path: string,
	options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown>; text: string }> {
	const res = await fetch(`${base}${path}`, {
		method: options.method ?? "GET",
		redirect: "manual",
		headers: {
			...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
			...(options.body ? { "content-type": "application/json" } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	const text = await res.text();
	let body: Record<string, unknown> = {};
	try {
		body = JSON.parse(text) as Record<string, unknown>;
	} catch {
		// Non-JSON (redirects): leave the body empty.
	}
	return { status: res.status, body, text };
}

describe("GET /api/tunnels", () => {
	test("an account JWT with tunnels:read gets its list", async () => {
		const res = await call("/api/tunnels", {
			token: await idp.sign({ sub: "acc_x", scope: "tunnels:read" }),
		});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ tunnels: [] });
	});

	test("refuses missing, anonymous and open-only tokens", async () => {
		expect((await call("/api/tunnels")).status).toBe(401);
		const anon = await call("/api/tunnels", { token: deviceToken });
		expect(anon.status).toBe(403);
		expect(anon.body).toMatchObject({ error: { code: "TUNELO_AUTH_003" } });
		const openOnly = await call("/api/tunnels", {
			token: await idp.sign({ scope: "tunnels:open" }),
		});
		expect(openOnly.status).toBe(403);
	});
});

describe("link routes", () => {
	test("a client links an anonymous machine and lists with the link token", async () => {
		const init = await call("/api/links/init", {
			method: "POST",
			body: { clientName: "Localman" },
		});
		expect(init.status).toBe(200);
		const { requestId, code } = init.body as {
			requestId: string;
			code: string;
		};

		const approve = await call("/api/links/approve", {
			method: "POST",
			token: deviceToken,
			body: { code },
		});
		expect(approve.body).toEqual({ clientName: "Localman" });

		const poll = await call("/api/links/poll", {
			method: "POST",
			body: { requestId },
		});
		const linkToken = String(poll.body.token);
		expect(linkToken).toMatch(/^tunelo_/);

		const list = await call("/api/tunnels", { token: linkToken });
		expect(list.status).toBe(200);
		expect(list.text).not.toMatch(/hash|tunelo_/i);

		const links = await call("/api/links", { token: deviceToken });
		expect((links.body.links as unknown[]).length).toBe(1);

		// A link token cannot approve or list links, only revoke itself.
		expect((await call("/api/links", { token: linkToken })).status).toBe(403);
		const self = await call("/api/links/self", {
			method: "DELETE",
			token: linkToken,
		});
		expect(self.body).toEqual({ ok: true });
		expect((await call("/api/tunnels", { token: linkToken })).status).toBe(401);
	});

	test("approving needs the machine's anonymous token", async () => {
		const res = await call("/api/links/approve", {
			method: "POST",
			token: await idp.sign(),
			body: { code: "ABCD-EFGH" },
		});
		expect(res.status).toBe(403);
	});
});

describe("anonymous device login in hybrid mode", () => {
	test("opening and approving a request are refused with an upgrade hint", async () => {
		const res = await call("/api/device/init", {
			method: "POST",
			body: { deviceId: "d", name: "n" },
		});
		expect(res.status).toBe(403);
		expect(res.body).toMatchObject({ error: { code: "TUNELO_DEVICE_004" } });
		const approve = await call("/api/device/approve", {
			method: "POST",
			body: { req: "x" },
		});
		expect(approve.status).toBe(403);
	});

	test("the old approve page sends the browser to the identity provider", async () => {
		const res = await fetch(`${base}/login?req=abc`, { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(`${TEST_ISSUER}/account`);
	});

	test("/api/verify reports the kind and the cutoff", async () => {
		const res = await call("/api/verify", { token: deviceToken });
		expect(res.body).toEqual({
			valid: true,
			kind: "legacy",
			legacyTokenCutoff: "2099-01-01T00:00:00.000Z",
		});
	});
});
