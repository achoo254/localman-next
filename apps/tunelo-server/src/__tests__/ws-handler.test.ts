import http from "node:http";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import { attachWsHandler } from "../ws-handler.js";

/** No token ever validates — these tests only exercise the upgrade gate. */
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

describe("ws upgrade rejection", () => {
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

	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	/** Raw upgrade handshake — returns whatever bytes the server wrote back. */
	function upgrade(host: string, path = "/socket.io/?EIO=4"): Promise<string> {
		const request = [
			`GET ${path} HTTP/1.1`,
			`Host: ${host}`,
			"Upgrade: websocket",
			"Connection: Upgrade",
			"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
			"Sec-WebSocket-Version: 13",
			"",
			"",
		].join("\r\n");

		return new Promise((resolve, reject) => {
			const socket = net.connect(port, "127.0.0.1", () => {
				socket.write(request);
			});
			const chunks: Buffer[] = [];
			socket.on("data", (c: Buffer) => chunks.push(c));
			socket.on("close", () => resolve(Buffer.concat(chunks).toString()));
			socket.on("error", reject);
			socket.setTimeout(5000, () => {
				socket.destroy();
				reject(new Error("upgrade timed out"));
			});
		});
	}

	test("unknown subdomain gets 502, not a bare socket close", async () => {
		const raw = await upgrade("nosuchtunnel.tunnel.example.test");
		expect(raw).not.toBe("");
		expect(raw).toContain("HTTP/1.1 502 Bad Gateway");
		expect(raw).toContain("Tunnel not found: nosuchtunnel");
	});

	test("apex host on a non-control path gets 400", async () => {
		const raw = await upgrade("tunnel.example.test", "/socket.io/?EIO=4");
		expect(raw).toContain("HTTP/1.1 400 Bad Request");
		expect(raw).toContain("no tunnel subdomain");
	});

	test("rejection carries a framed body the peer can read", async () => {
		const raw = await upgrade("nosuchtunnel.tunnel.example.test");
		expect(raw).toContain("content-length:");
		expect(raw).toContain("connection: close");
	});
});
