import { once } from "node:events";
import http from "node:http";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { RAW_FALLBACK_BYTES, readResponseBody } from "./proxy-response-body.js";
import { useTestServer } from "./proxy-test-server.js";

const server = useTestServer();

async function fetchBody(path: string, limit?: number) {
	const req = http.get(`${server.origin}${path}`);
	const [response] = (await once(req, "response")) as [http.IncomingMessage];
	return readResponseBody(response, limit);
}

/** Text that compresses poorly enough to span many deflate blocks. */
function sampleText(bytes: number): Buffer {
	const parts: string[] = [];
	let length = 0;
	for (let i = 0; length < bytes; i++) {
		const part = `${i.toString(36)}:${((i * 2654435761) >>> 0).toString(16)};`;
		parts.push(part);
		length += part.length;
	}
	return Buffer.from(parts.join("").slice(0, bytes));
}

describe("response body reader", () => {
	it("reads a body mislabelled as gzip raw and in full, past the fallback size", async () => {
		const plain = sampleText(RAW_FALLBACK_BYTES * 3);
		server.routes.set("/plain-as-gzip", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			// Several writes: the decoder fails on the first, the rest
			// must still arrive raw.
			const chunk = RAW_FALLBACK_BYTES / 2;
			for (let at = 0; at < plain.length; at += chunk) {
				res.write(plain.subarray(at, at + chunk));
			}
			res.end();
		});
		const body = await fetchBody("/plain-as-gzip");
		expect(body.truncated).toBe(false);
		expect(body.bytes.equals(plain)).toBe(true);
	});

	it("still caps a mislabelled body at the limit", async () => {
		const plain = sampleText(4096);
		server.routes.set("/plain-as-gzip-small", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(plain);
		});
		const body = await fetchBody("/plain-as-gzip-small", 1000);
		expect(body.truncated).toBe(true);
		expect(body.bytes.equals(plain.subarray(0, 1000))).toBe(true);
	});

	it("keeps the decoded part of a body corrupted mid-stream, marked truncated", async () => {
		const text = sampleText(512 * 1024);
		const gz = gzipSync(text);
		const corrupt = Buffer.from(gz);
		corrupt.fill(
			0xff,
			Math.floor(gz.length / 2),
			Math.floor(gz.length / 2) + 64,
		);
		server.routes.set("/corrupt-gzip", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(corrupt);
		});
		const body = await fetchBody("/corrupt-gzip");
		expect(body.truncated).toBe(true);
		expect(body.bytes.length).toBeGreaterThan(0);
		expect(body.bytes.length).toBeLessThan(text.length);
		// Bytes before the damage decode as sent.
		const head = body.bytes.subarray(0, 1024);
		expect(head.equals(text.subarray(0, 1024))).toBe(true);
	});

	it("decodes a valid gzip body in full", async () => {
		const text = sampleText(300 * 1024);
		server.routes.set("/gzip-ok", (_req, res) => {
			res.writeHead(200, { "content-encoding": "gzip" });
			res.end(gzipSync(text));
		});
		const body = await fetchBody("/gzip-ok");
		expect(body.truncated).toBe(false);
		expect(body.bytes.equals(text)).toBe(true);
	});
});
