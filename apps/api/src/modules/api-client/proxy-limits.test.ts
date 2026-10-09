import { gzipSync } from "node:zlib";
import { brotliCompressSync } from "node:zlib";
import { OperationError } from "@localman/operations";
import {
	MAX_RESPONSE_BODY_BYTES,
	type ProxyRequestInput,
	proxyRequestSchema,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { forwardRequest } from "./proxy-forwarder.js";
import { testGuard, useTestServer } from "./proxy-test-server.js";

const server = useTestServer();

function send(input: ProxyRequestInput) {
	return forwardRequest(proxyRequestSchema.parse(input), {
		guard: testGuard(),
		clientIp: null,
		forwardedProto: "https",
	});
}

describe("proxy limits", () => {
	it("times out a target that never answers", async () => {
		server.routes.set("/hang", () => {});
		const started = Date.now();
		const error = await send({
			method: "GET",
			url: `${server.origin}/hang`,
			options: { timeoutMs: 1000 },
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(OperationError);
		expect(error).toMatchObject({
			status: 504,
			code: "PROXY_TIMEOUT",
			details: { timeoutMs: 1000 },
		});
		expect(Date.now() - started).toBeLessThan(5000);
	});

	it("applies the deadline to the body too", async () => {
		server.routes.set("/trickle", (_req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.write("start");
		});
		const error = await send({
			method: "GET",
			url: `${server.origin}/trickle`,
			options: { timeoutMs: 1000 },
		}).catch((e: unknown) => e);
		expect(error).toMatchObject({ code: "PROXY_TIMEOUT" });
	});

	it("cuts a body past 10 MB and says so", async () => {
		const chunk = Buffer.alloc(1024 * 1024, "a");
		server.routes.set("/big", (_req, res) => {
			for (let i = 0; i < 11; i++) res.write(chunk);
			res.end();
		});
		const response = await send({ method: "GET", url: `${server.origin}/big` });
		expect(response.truncated).toBe(true);
		expect(response.size).toBe(MAX_RESPONSE_BODY_BYTES);
		expect(response.bodyEncoding).toBe("utf8");
		expect(response.body.length).toBe(MAX_RESPONSE_BODY_BYTES);
	});

	it("does not cut a body of exactly 10 MB", async () => {
		server.routes.set("/exact", (_req, res) => {
			res.end(Buffer.alloc(MAX_RESPONSE_BODY_BYTES, "b"));
		});
		const response = await send({
			method: "GET",
			url: `${server.origin}/exact`,
		});
		expect(response.truncated).toBe(false);
		expect(response.size).toBe(MAX_RESPONSE_BODY_BYTES);
	});

	it("keeps text when the cut splits a UTF-8 character", async () => {
		// "é" is 2 bytes: an odd prefix puts the cut inside one.
		const body = Buffer.concat([
			Buffer.from("x"),
			Buffer.from("é".repeat(MAX_RESPONSE_BODY_BYTES)),
		]);
		server.routes.set("/accents", (_req, res) => res.end(body));
		const response = await send({
			method: "GET",
			url: `${server.origin}/accents`,
		});
		expect(response.truncated).toBe(true);
		expect(response.bodyEncoding).toBe("utf8");
		expect(response.size).toBe(MAX_RESPONSE_BODY_BYTES - 1);
	});

	it("decompresses gzip and br bodies, keeping the header visible", async () => {
		const text = JSON.stringify({ hello: "world", n: [1, 2, 3] });
		server.routes.set("/gzip", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(gzipSync(text));
		});
		server.routes.set("/br", (_req, res) => {
			res.writeHead(200, { "content-encoding": "br" });
			res.end(brotliCompressSync(text));
		});
		for (const path of ["/gzip", "/br"]) {
			const response = await send({
				method: "GET",
				url: `${server.origin}${path}`,
			});
			expect(response.body).toBe(text);
			expect(response.size).toBe(Buffer.byteLength(text));
			expect(response.headers.some((h) => h.name === "content-encoding")).toBe(
				true,
			);
		}
	});

	it("caps a decompression bomb at 10 MB of output", async () => {
		const bomb = gzipSync(Buffer.alloc(64 * 1024 * 1024));
		server.routes.set("/bomb", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(bomb);
		});
		const response = await send({
			method: "GET",
			url: `${server.origin}/bomb`,
		});
		expect(response.truncated).toBe(true);
		expect(response.size).toBe(MAX_RESPONSE_BODY_BYTES);
	});

	it("returns a body that fails to decompress as raw bytes", async () => {
		const raw = Buffer.from("not really gzip");
		server.routes.set("/bad-gzip", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(raw);
		});
		const response = await send({
			method: "GET",
			url: `${server.origin}/bad-gzip`,
		});
		expect(response.body).toBe("not really gzip");
		expect(response.truncated).toBe(false);
	});

	it("reports a refused connection", async () => {
		const error = await send({
			method: "GET",
			url: "http://127.0.0.1:1/",
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(OperationError);
		expect(error).toMatchObject({
			status: 502,
			code: "PROXY_CONNECTION_FAILED",
			details: { cause: "ECONNREFUSED" },
		});
	});

	it("rejects a request body over 10 MB in the envelope", () => {
		const parsed = proxyRequestSchema.safeParse({
			method: "POST",
			url: server.origin || "http://a.test/",
			body: "a".repeat(10 * 1024 * 1024 + 1),
			bodyType: "text",
		});
		expect(parsed.success).toBe(false);
	});
});
