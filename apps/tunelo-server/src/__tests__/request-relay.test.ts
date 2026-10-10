import http from "node:http";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createRelayHandler, extractSubdomain } from "../request-relay.js";

describe("extractSubdomain", () => {
	test("extracts from standard host header", () => {
		expect(extractSubdomain("myapp.tunnel.inetdev.io.vn")).toBe("myapp");
	});

	test("extracts with port in host", () => {
		expect(extractSubdomain("myapp.tunnel.inetdev.io.vn:3001")).toBe("myapp");
	});

	test("returns null for bare domain", () => {
		expect(extractSubdomain("tunnel.inetdev.io.vn")).toBeNull();
	});

	test("returns null for non-matching domain", () => {
		expect(extractSubdomain("example.com")).toBeNull();
	});

	test("extracts hyphenated subdomain", () => {
		expect(extractSubdomain("my-cool-app.tunnel.inetdev.io.vn")).toBe(
			"my-cool-app",
		);
	});

	test("accepts every configured domain, primary or not", () => {
		expect(extractSubdomain("myapp.tunnel.hoandat.com")).toBe("myapp");
		expect(extractSubdomain("MyApp.Tunnel.Hoandat.com:443")).toBe("myapp");
		expect(extractSubdomain("tunnel.hoandat.com")).toBeNull();
	});

	test("an apex that is also under a shorter domain stays the apex", () => {
		const domains = ["x.io", "tunnel.x.io"];
		expect(extractSubdomain("tunnel.x.io", domains)).toBeNull();
		expect(extractSubdomain("app.tunnel.x.io", domains)).toBe("app");
	});

	test("rejects hosts that only contain a tunnel domain", () => {
		expect(extractSubdomain("a.tunnel.hoandat.com.evil.com")).toBeNull();
		expect(extractSubdomain("a.b.tunnel.hoandat.com")).toBeNull();
		expect(extractSubdomain("xtunnel.hoandat.com")).toBeNull();
	});
});

describe("relay handler — control-plane host gating", () => {
	let server: http.Server;
	let port: number;

	beforeAll(async () => {
		server = http.createServer(createRelayHandler());
		await new Promise<void>((resolve) => server.listen(0, resolve));
		const addr = server.address();
		port = typeof addr === "object" && addr ? addr.port : 0;
	});

	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	function get(
		path: string,
		host: string,
	): Promise<{ status: number; body: string }> {
		return new Promise((resolve, reject) => {
			const r = http.request(
				{ hostname: "127.0.0.1", port, path, method: "GET", headers: { host } },
				(res) => {
					const chunks: Buffer[] = [];
					res.on("data", (c: Buffer) => chunks.push(c));
					res.on("end", () =>
						resolve({
							status: res.statusCode ?? 0,
							body: Buffer.concat(chunks).toString(),
						}),
					);
				},
			);
			r.on("error", reject);
			r.end();
		});
	}

	test("apex /health returns tunelo health JSON", async () => {
		const res = await get("/health", "tunnel.inetdev.io.vn");
		expect(res.status).toBe(200);
		expect(JSON.parse(res.body).status).toBe("ok");
	});

	test("tenant /health is relayed to the app (not tunelo health)", async () => {
		// No tunnel registered for this subdomain → relayed path 502s, proving
		// /health was NOT short-circuited to tunelo's own health.
		const res = await get("/health", "myapp.tunnel.inetdev.io.vn");
		expect(res.status).toBe(502);
		expect(res.body).toContain("Tunnel not found");
	});

	test("apex non-health path is rejected (no tunnel subdomain)", async () => {
		const res = await get("/", "tunnel.inetdev.io.vn");
		expect(res.status).toBe(400);
	});
});
