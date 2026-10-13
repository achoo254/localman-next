import http from "node:http";
import net from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import {
	configureTenants,
	singleTenantDirectory,
} from "../tenancy/tenant-directory.js";
import type { TunnelTenant } from "../tenancy/tunnel-tenant.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { attachWsHandler } from "../ws-handler.js";

const authenticator: TokenAuthenticator = {
	config: {
		mode: "hybrid",
		issuer: "https://auth.test.local",
		audience: "https://tunnel.hoandat.com",
		legacyCutoffMs: null,
	},
	authenticate: async () => ({
		ok: false,
		code: "TUNELO_AUTH_001",
		message: "Invalid or expired token",
		retryable: false,
	}),
	legacyCutoffIso: () => undefined,
};

const UPGRADE = [
	"GET /socket.io/?EIO=4 HTTP/1.1",
	"Host: app.tunnel.acme.test",
	"Upgrade: websocket",
	"Connection: Upgrade",
	"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
	"Sec-WebSocket-Version: 13",
	"",
	"",
].join("\r\n");

describe("ws upgrade while the tenant lookup is pending", () => {
	let server: http.Server;
	let port: number;

	beforeAll(async () => {
		server = http.createServer((_req, res) => {
			res.writeHead(404);
			res.end();
		});
		attachWsHandler(server, authenticator);
		await new Promise<void>((resolve) => server.listen(0, resolve));
		const addr = server.address();
		port = typeof addr === "object" && addr ? addr.port : 0;
	});

	afterEach(() => configureTenants(singleTenantDirectory(TEST_TENANT)));
	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	function slowDirectory(): { release: () => void; asked: Promise<void> } {
		let release = (): void => undefined;
		let asked = (): void => undefined;
		const askedPromise = new Promise<void>((resolve) => {
			asked = resolve;
		});
		const answer = new Promise<TunnelTenant | undefined>((resolve) => {
			release = () => resolve(undefined);
		});
		configureTenants({
			byHost: () => {
				asked();
				return answer;
			},
			byId: async () => undefined,
		});
		return { release: () => release(), asked: askedPromise };
	}

	function send(): Promise<string> {
		return new Promise((resolve, reject) => {
			const socket = net.connect(port, "127.0.0.1", () =>
				socket.write(UPGRADE),
			);
			const chunks: Buffer[] = [];
			socket.on("data", (c: Buffer) => chunks.push(c));
			socket.on("close", () => resolve(Buffer.concat(chunks).toString()));
			socket.on("error", reject);
		});
	}

	test("a client reset during the lookup does not crash the server", async () => {
		const { release, asked } = slowDirectory();
		const socket = net.connect(port, "127.0.0.1", () => socket.write(UPGRADE));
		socket.on("error", () => undefined);
		await asked;
		socket.resetAndDestroy();
		await new Promise((resolve) => setTimeout(resolve, 50));
		release();
		await new Promise((resolve) => setTimeout(resolve, 20));

		configureTenants(singleTenantDirectory(TEST_TENANT));
		const raw = await send();
		expect(raw).toContain("HTTP/1.1 421 Misdirected Request");
	});

	test("an IdP failure answers 503 like the HTTP path", async () => {
		configureTenants({
			byHost: async () => {
				throw new Error("IdP down");
			},
			byId: async () => undefined,
		});
		const raw = await send();
		expect(raw).toContain("HTTP/1.1 503 Service Unavailable");
	});
});
