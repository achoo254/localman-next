import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import pino from "pino";
import { expect, test } from "vitest";
import { mountWebConsole } from "../web-console.js";
import { RELAY_FALLBACK } from "./web-harness.js";

const defaults = {
	issuer: "https://auth.hoandat.com",
	primaryDomain: "tunnel.hoandat.com",
};
const SECRET = "secret-value-that-must-not-be-logged";
const KEY = randomBytes(32).toString("base64url");

/** GET on the public host (fetch cannot set `Host`). */
function get(
	port: number,
	path: string,
): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: "127.0.0.1",
				port,
				path,
				headers: { host: "tunnel.hoandat.com" },
			},
			(res) => {
				let body = "";
				res.on("data", (chunk: Buffer) => {
					body += chunk.toString("utf8");
				});
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
			},
		);
		req.on("error", reject);
		req.end();
	});
}

/**
 * The apex routes of server.ts around the console: `/api` and `/login` first,
 * then the console (when it mounts), then the relay fallback. Returns what
 * `/`, `/api/ping`, `/login` and `/auth/login` answer, plus the log lines.
 */
async function serverRoutesWith(
	env: NodeJS.ProcessEnv,
	paths = ["/", "/api/ping", "/login", "/auth/login"],
) {
	const lines: string[] = [];
	const logger = pino({}, { write: (line: string) => lines.push(line) });
	const app = express();
	app.get("/api/ping", (_req, res) => {
		res.json({ ok: true });
	});
	app.get("/login", (_req, res) => {
		res.redirect(302, "https://auth.hoandat.com/account");
	});
	const mounted = mountWebConsole(app, env, defaults, logger);
	app.use((_req, res) => {
		res.status(400).type("text/plain").send(RELAY_FALLBACK);
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const { port } = server.address() as AddressInfo;
		const statuses: Record<string, number> = {};
		for (const path of paths) {
			const res = await get(port, path);
			statuses[path] = res.status;
			if (res.status === 400) expect(res.body).toBe(RELAY_FALLBACK);
		}
		return { mounted, statuses, logs: lines.join("") };
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

const UNCHANGED = {
	"/": 400,
	"/api/ping": 200,
	"/login": 302,
	"/auth/login": 400,
};

test("without its variables the console stays off and the routes answer as before", async () => {
	const result = await serverRoutesWith({
		TUNELO_WEB_CLIENT_SECRET: SECRET,
		WEB_SESSION_KEY: "short",
	});
	expect(result.mounted).toBe(false);
	expect(result.statuses).toEqual(UNCHANGED);
	expect(result.logs).toContain("Web console disabled");
	expect(result.logs).toContain("WEB_SESSION_KEY");
	expect(result.logs).not.toContain(SECRET);
	expect(result.logs).not.toContain('"short"');
});

test.each(["https://[::1", "not a url", "https://tunnel.hoandat.com/path"])(
	"a malformed TUNELO_WEB_PUBLIC_URL (%s) keeps the server routes working",
	async (publicUrl) => {
		const result = await serverRoutesWith({
			TUNELO_WEB_CLIENT_SECRET: SECRET,
			WEB_SESSION_KEY: KEY,
			TUNELO_WEB_PUBLIC_URL: publicUrl,
		});
		expect(result.mounted).toBe(false);
		expect(result.statuses).toEqual(UNCHANGED);
		expect(result.logs).toContain("TUNELO_WEB_PUBLIC_URL");
		expect(result.logs).not.toContain(publicUrl);
		expect(result.logs).not.toContain(SECRET);
	},
);

test("an error while setting the console up is logged and never thrown", async () => {
	const env = new Proxy<NodeJS.ProcessEnv>(
		{},
		{
			get() {
				throw new Error("environment unreadable");
			},
		},
	);
	const result = await serverRoutesWith(env);
	expect(result.mounted).toBe(false);
	expect(result.statuses).toEqual(UNCHANGED);
	expect(result.logs).toContain("Web console setup failed; console disabled");
});

test("a valid configuration mounts the console", async () => {
	// `/auth/login` would contact the real IdP: not requested here.
	const result = await serverRoutesWith(
		{ TUNELO_WEB_CLIENT_SECRET: SECRET, WEB_SESSION_KEY: KEY },
		["/", "/api/ping", "/login"],
	);
	expect(result.mounted).toBe(true);
	expect(result.statuses["/"]).toBe(200);
	expect(result.statuses["/api/ping"]).toBe(200);
	expect(result.statuses["/login"]).toBe(302);
	expect(result.logs).not.toContain(SECRET);
	expect(result.logs).not.toContain(KEY);
});
