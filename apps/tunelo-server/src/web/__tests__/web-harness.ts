import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import pino from "pino";
import { type TunnelSources, listByOwner } from "../../tunnel-directory.js";
import type { WebConfig } from "../web-config.js";
import { createWebConsole } from "../web-console.js";
import { startFakeIssuer } from "./fake-oidc-issuer.js";
import type { FakeIssuer } from "./fake-oidc-support.js";

/** https, so the production cookie names and flags are exercised. */
export const PUBLIC_URL = "https://tunnel.test";
export const PUBLIC_HOST = "tunnel.test";
export const SESSION_COOKIE = "__Host-tunelo_session";
export const AUTH_COOKIE = "__Host-tunelo_auth";
/** What the relay answers on the apex today, for paths the console leaves. */
export const RELAY_FALLBACK = "Bad Request: no tunnel subdomain in Host header";

export interface WebResponse {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: string;
	/** `name=value` of every Set-Cookie (attributes dropped). */
	cookies: Map<string, string>;
	/** Raw Set-Cookie headers, attributes included. */
	setCookies: string[];
}

export interface WebHarness {
	readonly idp: FakeIssuer;
	readonly config: WebConfig;
	/** Every log line written so far (JSON, one per line). */
	logs(): string;
	request(
		path: string,
		options?: {
			method?: string;
			cookie?: string;
			host?: string;
			form?: Record<string, string>;
			headers?: Record<string, string>;
		},
	): Promise<WebResponse>;
	/** Full sign-in through the fake IdP; returns the session cookie pair. */
	signIn(): Promise<string>;
	close(): Promise<void>;
}

function parseSetCookies(raw: string[]): Map<string, string> {
	const cookies = new Map<string, string>();
	for (const header of raw) {
		const pair = header.split(";")[0] ?? "";
		const separator = pair.indexOf("=");
		if (separator > 0) {
			cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
		}
	}
	return cookies;
}

/**
 * TEST ONLY. The console behind an express app shaped like server.ts (the
 * console, then the apex relay fallback) and a fake IdP, over real sockets.
 * MongoDB must already be connected (see test-support/test-mongo.ts).
 */
export async function startWebHarness(
	sources: TunnelSources = { http: () => [], tcp: () => [] },
	options: { signInLimitPerMinute?: number } = {},
): Promise<WebHarness> {
	const idp = await startFakeIssuer(PUBLIC_URL);
	const lines: string[] = [];
	const logger = pino(
		{ level: "debug" },
		{ write: (line: string) => lines.push(line) },
	);
	const config: WebConfig = {
		clientId: idp.clientId,
		clientSecret: idp.clientSecret,
		publicUrl: PUBLIC_URL,
		sessionKey: randomBytes(32),
		issuer: idp.issuer,
	};
	const app = express();
	app.use(
		createWebConsole({
			config,
			logger,
			tunnelDomain: "tunnel.hoandat.com",
			listTunnels: (sub) => listByOwner(sub, sources),
			allowInsecureRequests: true,
			// Tests sign in far more often than a person would.
			signInLimitPerMinute: options.signInLimitPerMinute ?? 10_000,
		}),
	);
	app.use((_req, res) => {
		res.status(400).type("text/plain").send(RELAY_FALLBACK);
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = (server.address() as AddressInfo).port;

	const request: WebHarness["request"] = (path, options = {}) =>
		new Promise((resolve, reject) => {
			const body = options.form
				? new URLSearchParams(options.form).toString()
				: undefined;
			const req = http.request(
				{
					host: "127.0.0.1",
					port,
					path,
					method: options.method ?? "GET",
					headers: {
						host: options.host ?? PUBLIC_HOST,
						...(options.cookie ? { cookie: options.cookie } : {}),
						...(body
							? { "content-type": "application/x-www-form-urlencoded" }
							: {}),
						...options.headers,
					},
				},
				(res) => {
					let text = "";
					res.on("data", (chunk: Buffer) => {
						text += chunk.toString("utf8");
					});
					res.on("end", () => {
						const setCookies = res.headers["set-cookie"] ?? [];
						resolve({
							status: res.statusCode ?? 0,
							headers: res.headers,
							body: text,
							cookies: parseSetCookies(setCookies),
							setCookies,
						});
					});
				},
			);
			req.on("error", reject);
			req.end(body);
		});

	return {
		idp,
		config,
		logs: () => lines.join(""),
		request,
		async signIn() {
			const start = await request("/auth/login");
			const auth = start.cookies.get(AUTH_COOKIE);
			const location = start.headers.location;
			if (start.status !== 303 || !auth || !location) {
				throw new Error(`login: ${start.status} ${start.body}`);
			}
			const back = await idp.authorize(location);
			const callback = await request(`${back.pathname}${back.search}`, {
				cookie: `${AUTH_COOKIE}=${auth}`,
			});
			const session = callback.cookies.get(SESSION_COOKIE);
			if (callback.status !== 303 || !session) {
				throw new Error(
					`callback: ${callback.status} ${callback.headers.location}`,
				);
			}
			return `${SESSION_COOKIE}=${session}`;
		},
		async close() {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
			await idp.close();
		},
	};
}
