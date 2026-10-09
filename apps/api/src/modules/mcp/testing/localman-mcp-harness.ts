import type { AddressInfo } from "node:net";
import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { type Express, Router } from "express";
import { createDashboardApp } from "../../../dashboard-server.js";
import { createLogger } from "../../../logger.js";
import {
	type LocalmanMcpOptions,
	createLocalmanMcpRouter,
} from "../localman-mcp-server.js";
import {
	TEST_ISSUER,
	TEST_PUBLIC_URL,
	type TestIdp,
} from "./idp-token-signer.js";

/** Cookie the stub session lookup accepts, as a signed-in browser has. */
export const SESSION_COOKIE = "lm_session=valid-session";
export const COOKIE_USER = "acc_cookie_user";

/**
 * TEST ONLY. The real dashboard app with Localman MCP mounted, tokens
 * verified against `idp`, and a session lookup that accepts
 * `SESSION_COOKIE` (to prove the cookie never authenticates `/mcp`).
 * `overrides` replace options of the Localman MCP router.
 */
export function createMcpTestApp(
	idp: TestIdp,
	overrides: Partial<LocalmanMcpOptions> = {},
): Express {
	const logger = createLogger("silent");
	return createDashboardApp({
		logger,
		allowedOrigins: [TEST_PUBLIC_URL],
		trustProxy: "loopback",
		auth: {
			router: Router(),
			csrfExempt: [],
			authenticate: async (req) =>
				req.headers.cookie?.includes(SESSION_COOKIE)
					? { id: "session-1", sub: COOKIE_USER }
					: null,
		},
		mcp: createLocalmanMcpRouter({
			publicUrl: TEST_PUBLIC_URL,
			issuer: TEST_ISSUER,
			keys: idp.keys,
			allowedOrigins: [TEST_PUBLIC_URL],
			logger,
			...overrides,
		}),
	});
}

export interface RunningApp {
	readonly url: string;
	close(): Promise<void>;
}

/** Listens on an ephemeral loopback port (the SDK client needs real HTTP). */
export async function listenOnLoopback(app: Express): Promise<RunningApp> {
	const server = await new Promise<ReturnType<Express["listen"]>>(
		(resolve, reject) => {
			const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
			listening.once("error", reject);
		},
	);
	const address: AddressInfo | string | null = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	return {
		url: `http://127.0.0.1:${address.port}`,
		close: () =>
			new Promise((resolve, reject) => {
				server.closeAllConnections();
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}

/**
 * An SDK client on `{url}/mcp{query}` sending `token` as Bearer: pinned
 * to 2026-07-28, or a 2025-era client (`legacy`, initialize handshake).
 */
export async function connectMcpClient(
	url: string,
	token: string,
	era: "modern" | "legacy" = "modern",
	query = "",
): Promise<Client> {
	const client = new Client(
		{ name: "localman-mcp-test", version: "0.0.0" },
		{
			versionNegotiation: {
				mode: era === "legacy" ? "legacy" : { pin: "2026-07-28" },
			},
		},
	);
	const transport = new StreamableHTTPClientTransport(
		new URL(`/mcp${query}`, url),
		{ requestInit: { headers: { Authorization: `Bearer ${token}` } } },
	);
	await client.connect(transport);
	return client;
}
