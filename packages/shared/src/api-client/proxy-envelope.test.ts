import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BODY_BYTES, MAX_TIMEOUT_MS } from "./limits.js";
import {
	proxyRequestSchema,
	proxyResponseSchema,
	toProxyEnvelope,
} from "./proxy-envelope.js";
import { DEFAULT_REQUEST_SETTINGS } from "./request-model.js";
import type { PreparedRequest } from "./request-preparer.js";

const prepared = (body: PreparedRequest["body"]): PreparedRequest => ({
	method: "POST",
	url: "https://x.test/a",
	headers: [
		{ name: "Cookie", value: "a=1" },
		{ name: "Cookie", value: "b=2" },
	],
	body,
	secretsUsed: [],
	unresolved: [],
});

describe("proxy request envelope", () => {
	it("fills defaults for a minimal envelope", () => {
		expect(
			proxyRequestSchema.parse({ method: "GET", url: "https://x.test" }),
		).toEqual({
			method: "GET",
			url: "https://x.test",
			headers: [],
			body: null,
			bodyType: "none",
			options: { followRedirects: true, timeoutMs: 30_000, sendClientIp: true },
		});
	});

	it("keeps header order and repeated names", () => {
		const env = toProxyEnvelope(
			prepared({ kind: "none" }),
			DEFAULT_REQUEST_SETTINGS,
		);
		expect(proxyRequestSchema.parse(env).headers).toEqual(env.headers);
	});

	it("encodes text as text and bytes as base64", () => {
		const settings = {
			followRedirects: false,
			timeoutMs: 5000,
			sendClientIp: false,
		};
		const textEnv = toProxyEnvelope(
			prepared({ kind: "text", text: "hi" }),
			settings,
		);
		expect(textEnv).toMatchObject({
			body: "hi",
			bodyType: "text",
			options: settings,
		});
		const bin = toProxyEnvelope(
			prepared({ kind: "bytes", bytes: new Uint8Array([0, 255]) }),
			settings,
		);
		expect(bin).toMatchObject({ body: "AP8=", bodyType: "base64" });
		expect(proxyRequestSchema.safeParse(bin).success).toBe(true);
	});

	it.each([
		[{ url: "ftp://x.test" }, "url"],
		[{ url: "/relative" }, "url"],
		[{ method: "TRACE" }, "method"],
		[{ headers: [{ name: "Bad Name", value: "1" }] }, "headers"],
		[{ headers: [{ name: "X-A", value: "1\r\nX-Evil: 1" }] }, "headers"],
		[{ body: "x", bodyType: "none" }, "body"],
		[{ body: null, bodyType: "text" }, "body"],
		[{ method: "GET", body: "x", bodyType: "text" }, "body"],
		[{ body: "not base64!", bodyType: "base64" }, "body"],
		[
			{ body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1), bodyType: "text" },
			"body",
		],
		[{ options: { timeoutMs: MAX_TIMEOUT_MS + 1 } }, "options"],
		[{ options: { timeoutMs: 10 } }, "options"],
	])("rejects %#", (overrides, field) => {
		const result = proxyRequestSchema.safeParse({
			method: "POST",
			url: "https://x.test",
			...overrides,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path[0]).toBe(field);
	});

	it("counts the body limit in UTF-8 bytes, not characters", () => {
		const chars = Math.floor(MAX_REQUEST_BODY_BYTES / 3) + 1;
		const result = proxyRequestSchema.safeParse({
			method: "POST",
			url: "https://x.test",
			body: "密".repeat(chars),
			bodyType: "text",
		});
		expect(result.success).toBe(false);
	});
});

describe("proxy response envelope", () => {
	it("accepts a full response with repeated Set-Cookie", () => {
		const response = {
			status: 200,
			statusText: "OK",
			headers: [
				{ name: "Set-Cookie", value: "a=1" },
				{ name: "Set-Cookie", value: "b=2" },
			],
			body: "AP8=",
			bodyEncoding: "base64",
			size: 2,
			timings: { dns: null, connect: 1, tls: null, ttfb: 3, total: 4 },
			finalUrl: "https://x.test/b",
			truncated: false,
		};
		expect(proxyResponseSchema.parse(response)).toEqual(response);
	});

	it("rejects an unknown body encoding", () => {
		const result = proxyResponseSchema.safeParse({ bodyEncoding: "hex" });
		expect(result.success).toBe(false);
	});

	it("lists only the secrets in the host for the proxy's log, never others", () => {
		const env = toProxyEnvelope(
			{
				...prepared({ kind: "none" }),
				url: "https://tenant-7c1f.api.test/a?key=query-value-1",
				secretValues: ["tenant-7c1f", "query-value-1"],
			},
			DEFAULT_REQUEST_SETTINGS,
		);
		expect(env.logMask).toEqual(["tenant-7c1f"]);
		const plain = toProxyEnvelope(
			prepared({ kind: "none" }),
			DEFAULT_REQUEST_SETTINGS,
		);
		expect(plain).not.toHaveProperty("logMask");
	});
});
