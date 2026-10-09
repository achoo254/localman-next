import {
	type ProxyRequestInput,
	proxyRequestSchema,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { forwardRequest } from "./proxy-forwarder.js";
import {
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "./proxy-test-server.js";

const server = useTestServer();
const guard = testGuard();

function send(
	input: ProxyRequestInput,
	clientIp: string | null = "198.51.100.7",
) {
	return forwardRequest(proxyRequestSchema.parse(input), {
		guard,
		clientIp,
		forwardedProto: "https",
	});
}

describe("proxy forwarding to an echo server", () => {
	it("sends the envelope's headers in order, repeats and forbidden ones included", async () => {
		const response = await send({
			method: "GET",
			url: `${server.origin}/users?page=2`,
			headers: [
				{ name: "Cookie", value: "theirs=1" },
				{ name: "User-Agent", value: "Agent/9" },
				{ name: "X-Dup", value: "one" },
				{ name: "Origin", value: "https://site.example" },
				{ name: "X-Dup", value: "two" },
			],
		});
		expect(response.status).toBe(200);
		const echo = echoOf(response.body);
		expect(echo.path).toBe("/users?page=2");
		const sent = echo.headers.map(([name]) => name);
		expect(sent.slice(0, 6)).toEqual([
			"Host",
			"Cookie",
			"User-Agent",
			"X-Dup",
			"Origin",
			"X-Dup",
		]);
		expect(headerValues(echo, "host")).toEqual([`127.0.0.1:${server.port}`]);
		expect(headerValues(echo, "x-dup")).toEqual(["one", "two"]);
		expect(headerValues(echo, "cookie")).toEqual(["theirs=1"]);
		expect(headerValues(echo, "user-agent")).toEqual(["Agent/9"]);
	});

	it("forwards the client IP and lets sendClientIp turn it off", async () => {
		const on = echoOf((await send({ method: "GET", url: server.origin })).body);
		expect(headerValues(on, "x-forwarded-for")).toEqual(["198.51.100.7"]);
		expect(headerValues(on, "x-real-ip")).toEqual(["198.51.100.7"]);
		expect(headerValues(on, "forwarded")).toEqual([
			"for=198.51.100.7;proto=https",
		]);
		const off = echoOf(
			(
				await send({
					method: "GET",
					url: server.origin,
					options: { sendClientIp: false },
				})
			).body,
		);
		for (const name of ["x-forwarded-for", "x-real-ip", "forwarded"]) {
			expect(headerValues(off, name)).toEqual([]);
		}
	});

	it("never forwards hop-by-hop headers", async () => {
		const echo = echoOf(
			(
				await send({
					method: "GET",
					url: server.origin,
					headers: [
						{ name: "Connection", value: "X-Private" },
						{ name: "X-Private", value: "secret" },
						{ name: "Keep-Alive", value: "timeout=5" },
						{ name: "TE", value: "trailers" },
						{ name: "Upgrade", value: "h2c" },
						{ name: "Proxy-Authorization", value: "Basic eDp5" },
					],
				})
			).body,
		);
		for (const name of [
			"x-private",
			"keep-alive",
			"te",
			"upgrade",
			"proxy-authorization",
		]) {
			expect(headerValues(echo, name)).toEqual([]);
		}
		// The proxy's own hop: one fresh connection per request.
		expect(headerValues(echo, "connection")).toEqual(["close"]);
	});

	it("sends a binary body byte for byte and returns binary as base64", async () => {
		const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
		const response = await send({
			method: "POST",
			url: server.origin,
			headers: [{ name: "Content-Type", value: "application/octet-stream" }],
			body: bytes.toString("base64"),
			bodyType: "base64",
		});
		const echo = echoOf(response.body);
		expect(Buffer.from(echo.bodyBase64, "base64").equals(bytes)).toBe(true);
		expect(headerValues(echo, "content-length")).toEqual(["256"]);

		server.routes.set("/png", (_req, res) => {
			res.setHeader("content-type", "image/png");
			res.end(bytes);
		});
		const binary = await send({ method: "GET", url: `${server.origin}/png` });
		expect(binary.bodyEncoding).toBe("base64");
		expect(Buffer.from(binary.body, "base64").equals(bytes)).toBe(true);
		expect(binary.size).toBe(256);
	});

	it("sends text bodies as UTF-8 and an empty POST with Content-Length 0", async () => {
		const text = await send({
			method: "PUT",
			url: server.origin,
			body: "chào ✓",
			bodyType: "text",
		});
		expect(
			Buffer.from(echoOf(text.body).bodyBase64, "base64").toString("utf8"),
		).toBe("chào ✓");
		const empty = echoOf(
			(await send({ method: "POST", url: server.origin })).body,
		);
		expect(headerValues(empty, "content-length")).toEqual(["0"]);
	});

	it("returns status, headers in arrival order with Set-Cookie, timings and finalUrl", async () => {
		server.routes.set("/cookies", (_req, res) => {
			res.writeHead(201, "Made It", [
				"Set-Cookie",
				"a=1; Path=/",
				"X-Order",
				"first",
				"Set-Cookie",
				"b=2; HttpOnly",
			]);
			res.end("ok");
		});
		const response = await send({
			method: "GET",
			url: `${server.origin}/cookies`,
		});
		expect(response.status).toBe(201);
		expect(response.statusText).toBe("Made It");
		const names = response.headers.map((h) => h.name);
		expect(names.slice(0, 3)).toEqual(["Set-Cookie", "X-Order", "Set-Cookie"]);
		expect(response.headers[2]?.value).toBe("b=2; HttpOnly");
		expect(response).toMatchObject({
			body: "ok",
			bodyEncoding: "utf8",
			size: 2,
			truncated: false,
		});
		expect(response.finalUrl).toBe(`${server.origin}/cookies`);
		const { dns, connect, tls, ttfb, total } = response.timings;
		expect(dns).toBeNull();
		expect(tls).toBeNull();
		expect(connect).toBeGreaterThanOrEqual(0);
		expect(ttfb).toBeGreaterThanOrEqual(connect ?? 0);
		expect(total).toBeGreaterThanOrEqual(ttfb ?? 0);
	});

	it("measures DNS for a host name and keeps it as Host", async () => {
		const response = await send({
			method: "GET",
			url: `http://echo.test:${server.port}/`,
		});
		expect(response.timings.dns).toBeGreaterThanOrEqual(0);
		expect(headerValues(echoOf(response.body), "host")).toEqual([
			`echo.test:${server.port}`,
		]);
	});
});
