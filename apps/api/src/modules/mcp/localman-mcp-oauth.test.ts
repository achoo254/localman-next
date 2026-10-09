import { randomBytes } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { Client } from "@modelcontextprotocol/client";
import { decodeJwt } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { OidcClient } from "../auth/oidc-client.js";
import { startFakeIdp } from "../auth/testing/fake-idp.js";
import { TestBrowser } from "../auth/testing/test-browser.js";
import { createLocalmanMcpRouter } from "./localman-mcp-server.js";
import {
	InMemoryOAuthProvider,
	connectWithOAuth,
} from "./testing/mcp-oauth-client.js";
import { structuredOf } from "./testing/tool-structured-content.js";

let publicUrl = "";
let issuer = "";
const servers: Server[] = [];

useDashboardTestDb(() => ({ publicUrl }));

async function listen(server: Server): Promise<string> {
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve());
	});
	servers.push(server);
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	return `http://127.0.0.1:${address.port}`;
}

beforeAll(async () => {
	const logger = createLogger("silent");
	const clientSecret = randomBytes(24).toString("base64url");
	const idpServer = createServer();
	const appServer = createServer();
	issuer = await listen(idpServer);
	publicUrl = await listen(appServer);
	const oidc = new OidcClient({
		issuer,
		clientId: "localman-web",
		clientSecret,
		publicUrl,
	});
	const app = createDashboardApp({
		logger,
		allowedOrigins: [publicUrl],
		mcp: createLocalmanMcpRouter({
			publicUrl,
			issuer,
			keys: oidc,
			allowedOrigins: [publicUrl],
			logger,
		}),
	});
	appServer.on("request", app);
	await startFakeIdp({
		server: idpServer,
		issuer,
		clientSecret,
		localmanPublicUrl: publicUrl,
		backchannelLogoutUri: `${publicUrl}/auth/backchannel-logout`,
		account: {
			sub: "acc_oauth_agent",
			username: "agent",
			email: "agent@example.test",
			name: "Agent",
		},
	});
});

afterAll(async () => {
	for (const server of servers.splice(0)) {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

async function idpEndpoint(name: string): Promise<string> {
	const response = await fetch(`${issuer}/.well-known/openid-configuration`);
	const metadata = z
		.record(z.string(), z.unknown())
		.parse(await response.json());
	const value = metadata[name];
	if (typeof value !== "string") throw new Error(`No ${name}`);
	return value;
}

function post(url: string, form: Record<string, string>) {
	return fetch(url, { method: "POST", body: new URLSearchParams(form) });
}

describe("Localman MCP with the IdP's OAuth flow", () => {
	it("discovers the IdP, registers, gets consent and a token, calls tools; revoking ends the grant", async () => {
		const provider = new InMemoryOAuthProvider("http://127.0.0.1:9/callback");
		const browser = new TestBrowser();
		let client: Client | undefined;
		try {
			client = await connectWithOAuth(
				`${publicUrl}/mcp`,
				provider,
				async (authorizationUrl) => {
					expect(authorizationUrl.searchParams.get("resource")).toBe(
						`${publicUrl}/mcp`,
					);
					// The SDK asks for offline_access (advertised by the IdP); the
					// IdP ignores it rather than failing the registration or
					// the authorization.
					expect(
						authorizationUrl.searchParams.get("scope")?.split(" "),
					).toContain("offline_access");
					const { stoppedAt } = await browser.navigate(
						authorizationUrl,
						provider.redirectUrl,
					);
					if (!stoppedAt) throw new Error("No redirect to the client");
					return stoppedAt;
				},
			);
			const project = structuredOf(
				await client.callTool({
					name: "create_project",
					arguments: { name: "Via OAuth" },
				}),
			);
			expect(project.uiUrl).toBe(`${publicUrl}/projects/${project.id}`);
		} finally {
			await client?.close();
		}

		const tokens = provider.tokens();
		const claims = decodeJwt(tokens?.access_token ?? "");
		expect(claims.aud).toBe(`${publicUrl}/mcp`);
		expect(String(claims.scope).split(" ")).toContain("mock:write");
		expect(String(claims.scope).split(" ")).not.toContain("offline_access");
		expect(provider.registeredScopes()).toContain("mock:write");
		expect(provider.registeredScopes()).not.toContain("offline_access");

		// Revoking the grant's refresh token: the client cannot renew access.
		const refreshToken = tokens?.refresh_token ?? "";
		const clientId = provider.clientInformation()?.client_id ?? "";
		expect(refreshToken).not.toBe("");
		const revoked = await post(await idpEndpoint("revocation_endpoint"), {
			token: refreshToken,
			token_type_hint: "refresh_token",
			client_id: clientId,
		});
		expect(revoked.status).toBe(200);
		const refresh = await post(await idpEndpoint("token_endpoint"), {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
		});
		expect(refresh.status).toBe(400);
		expect(await refresh.json()).toMatchObject({ error: "invalid_grant" });
	});
});
