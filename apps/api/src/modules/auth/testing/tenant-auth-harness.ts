import { randomBytes } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request, { type Response } from "supertest";
import { createDashboardApp } from "../../../dashboard-server.js";
import { createLogger } from "../../../logger.js";
import type { LocalmanTenant } from "../../../tenancy/tenant-context.js";
import { basic } from "../../audit/testing/security-events.js";
import { createAuthModule } from "../auth-module.js";
import { loopbackFetch } from "../loopback-fetch.js";
import { tenantClientSecret } from "../tenant-idp.js";
import {
	AUDIT_CREDENTIALS,
	LOGIN_COOKIE,
	PUBLIC_URL,
	SESSION_COOKIE,
	cookieFrom,
} from "./auth-harness.js";
import { type FakeAccount, type FakeIdp, startFakeIdp } from "./fake-idp.js";
import { TestBrowser } from "./test-browser.js";

export interface TenantAuthHarness {
	readonly app: Express;
	readonly idp: FakeIdp;
	readonly account: FakeAccount;
	/** Signs in on `localman.<domain>`; the session cookie and the callback. */
	signIn(): Promise<{ cookie: string; callback: Response }>;
	close(): Promise<void>;
}

function listen(server: Server): Promise<string> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
		});
	});
}

/**
 * TEST ONLY. Localman serving `tenant` as in production: its IdP (a fake
 * one with issuer `https://auth.<domain>`) reached only on loopback with
 * the tenant's Host, discovery and keys from a fake internal API, the
 * client secret derived from Localman's client key. The tenant directory
 * must already map `localman.<domain>` to `tenant`.
 */
export async function startTenantAuthHarness(
	tenant: LocalmanTenant,
	account: FakeAccount,
): Promise<TenantAuthHarness> {
	const logger = createLogger("silent");
	const clientKey = randomBytes(32).toString("base64url");
	const internalSecret = randomBytes(32).toString("base64url");
	const idpServer = createServer();
	const idpOrigin = await listen(idpServer);
	const toIdp = loopbackFetch(idpOrigin, new URL(tenant.issuer).origin);
	const internal = createServer((req, res) => {
		const routes: Record<string, string> = {
			[`/internal/tenants/${tenant.id}/openid-configuration`]:
				"/.well-known/openid-configuration",
			[`/internal/tenants/${tenant.id}/jwks`]: "/jwks",
		};
		const path = routes[req.url ?? ""];
		if (
			req.headers.authorization !== basic("localman", internalSecret) ||
			!path
		) {
			res.writeHead(req.headers.authorization ? 404 : 401).end();
			return;
		}
		toIdp(`${tenant.issuer}${path}`, {})
			.then(async (answer) => {
				res.writeHead(answer.status, { "content-type": "application/json" });
				res.end(Buffer.from(await answer.arrayBuffer()));
			})
			.catch(() => res.writeHead(502).end());
	});
	const internalUrl = await listen(internal);
	const auth = createAuthModule(
		{
			// The primary tenant's IdP is never reached here.
			issuer: "http://127.0.0.1:9",
			clientId: "localman-web",
			clientSecret: "unused-primary-secret",
			publicUrl: PUBLIC_URL,
			sessionEncryptionKey: `k1:${randomBytes(32).toString("base64")}`,
			loginLimitPerMinute: 10_000,
			audit: AUDIT_CREDENTIALS,
			tenantIdp: {
				internalUrl,
				internalSecret,
				loopbackUrl: idpOrigin,
				clientKey,
			},
		},
		logger,
	);
	const app = createDashboardApp({
		logger,
		allowedOrigins: [PUBLIC_URL],
		auth,
	});
	const idp = await startFakeIdp({
		server: idpServer,
		issuer: tenant.issuer,
		clientSecret: tenantClientSecret(clientKey, tenant.id),
		localmanPublicUrl: tenant.publicUrl,
		backchannelLogoutUri: `${tenant.publicUrl}/auth/backchannel-logout`,
		account,
	});
	// Behind "nginx": https and the tenant's Host come from the headers.
	idp.provider.proxy = true;
	const host = new URL(tenant.publicUrl).host;

	return {
		app,
		idp,
		account,
		async signIn() {
			const start = await request(app).get("/auth/login").set("host", host);
			if (start.status !== 303) throw new Error(`login: ${start.status}`);
			const browser = new TestBrowser((url, init) => toIdp(url.href, init));
			const { stoppedAt } = await browser.navigate(
				start.headers.location,
				`${tenant.publicUrl}/auth/callback`,
			);
			if (!stoppedAt) throw new Error("the IdP did not return to Localman");
			const callback = await request(app)
				.get(`${stoppedAt.pathname}${stoppedAt.search}`)
				.set("host", host)
				.set("cookie", cookieFrom(start, LOGIN_COOKIE) ?? "");
			const cookie = cookieFrom(callback, SESSION_COOKIE);
			if (!cookie) throw new Error(`callback: ${callback.status}`);
			return { cookie, callback };
		},
		async close() {
			for (const server of [idpServer, internal]) server.closeAllConnections();
			await Promise.all(
				[idpServer, internal].map(
					(server) => new Promise<void>((done) => server.close(() => done())),
				),
			);
		},
	};
}
