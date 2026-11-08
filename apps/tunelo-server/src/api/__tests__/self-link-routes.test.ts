import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createIdpTokenVerifier } from "../../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../../auth/token-authenticator.js";
import type { AuthConfig } from "../../config/auth-config.js";
import { MongoKeyStore } from "../../key-store/mongo-key-store.js";
import { machineSubdomain } from "../../machine-subdomain.js";
import { issueAccessToken } from "../../services/access-token-service.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../../test-support/idp-test-keys.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { createApiRouter } from "../create-api-router.js";

useTestDatabase("self-link-routes");

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

const DEVICE = "chat-agent.11111111-2222-4333-8444-555555555555";

async function selfLink(sub: string, deviceId = DEVICE) {
	return call("/api/links/self", {
		method: "POST",
		token: await idp.sign({ sub }),
		body: { deviceId, clientName: "Localman" },
	});
}

describe("an account links its own machine", () => {
	test("mints a link token bound to the account and machine", async () => {
		const minted = await selfLink("acc_self1");
		expect(minted.status).toBe(200);
		const token = String(minted.body.token);
		expect(token).toMatch(/^tunelo_/);
		const subdomain = machineSubdomain("acc_self1", DEVICE);
		expect(minted.body.forwardUrl).toBe(
			`https://${subdomain}.tunnel.hoandat.com/.tunelo/forward`,
		);

		const info = await call("/api/links/self", { token });
		expect(info.body).toEqual({
			linkId: minted.body.linkId,
			ownerSub: "acc_self1",
			deviceId: DEVICE,
			forwardUrl: minted.body.forwardUrl,
		});
		// It reads tunnels, never opens one.
		const tunnels = await call("/api/tunnels", { token });
		expect(tunnels.status).toBe(200);
		expect(tunnels.body.tunnels).toEqual([]);
	});

	test("linking again replaces the machine's earlier token", async () => {
		const first = String((await selfLink("acc_self2")).body.token);
		const second = String((await selfLink("acc_self2")).body.token);
		expect((await call("/api/links/self", { token: first })).status).toBe(401);
		expect((await call("/api/links/self", { token: second })).status).toBe(200);
	});

	test("needs an account token with tunnels:open and a valid device id", async () => {
		const noScope = await call("/api/links/self", {
			method: "POST",
			token: await idp.sign({ sub: "acc_self3", scope: "tunnels:read" }),
			body: { deviceId: DEVICE, clientName: "Localman" },
		});
		expect(noScope.status).toBe(403);
		const anonymous = await call("/api/links/self", {
			method: "POST",
			token: deviceToken,
			body: { deviceId: DEVICE, clientName: "Localman" },
		});
		expect(anonymous.status).toBe(403);
		const badDevice = await selfLink("acc_self3", "x");
		expect(badDevice.status).toBe(400);
	});

	test("a pairing token has no machine of an account to tell", async () => {
		const info = await call("/api/links/self", { token: deviceToken });
		expect(info.status).toBe(403);
	});

	test("the account lists and revokes its machines' links", async () => {
		const minted = await selfLink("acc_self4");
		const account = await idp.sign({ sub: "acc_self4" });
		const listed = await call("/api/links", { token: account });
		expect(listed.body.links).toEqual([
			expect.objectContaining({ id: minted.body.linkId, deviceId: DEVICE }),
		]);
		const stranger = await idp.sign({ sub: "acc_other" });
		const refused = await call(`/api/links/${String(minted.body.linkId)}`, {
			method: "DELETE",
			token: stranger,
		});
		expect(refused.status).toBe(404);
		const revoked = await call(`/api/links/${String(minted.body.linkId)}`, {
			method: "DELETE",
			token: account,
		});
		expect(revoked.status).toBe(200);
		const token = String(minted.body.token);
		expect((await call("/api/links/self", { token })).status).toBe(401);
	});

	test("an anonymous machine's list leaves account links out", async () => {
		const listed = await call("/api/links", { token: deviceToken });
		expect(listed.body.links).toEqual([]);
	});

	test("a link token can revoke itself", async () => {
		const token = String((await selfLink("acc_self5")).body.token);
		const res = await call("/api/links/self", { method: "DELETE", token });
		expect(res.status).toBe(200);
		expect((await call("/api/links/self", { token })).status).toBe(401);
	});
});
