import { describe, expect, it } from "vitest";
import {
	forbiddenHeaderNames,
	hopByHopNames,
	isForbiddenRequestHeader,
	isValidHeaderName,
	isValidHeaderValue,
	stripHopByHop,
} from "./header-rules.js";

describe("forbidden request headers", () => {
	it.each([
		"Cookie",
		"host",
		"Origin",
		"Referer",
		"Connection",
		"Content-Length",
		"User-Agent",
		"Proxy-Authorization",
		"Sec-Fetch-Mode",
		" accept-encoding ",
	])("%s cannot be set by fetch", (name) => {
		expect(isForbiddenRequestHeader(name)).toBe(true);
	});

	it.each(["Authorization", "Content-Type", "Accept", "X-Api-Key", "secret"])(
		"%s can be set by fetch",
		(name) => {
			expect(isForbiddenRequestHeader(name)).toBe(false);
		},
	);

	it("method overrides are forbidden only for CONNECT, TRACE, TRACK", () => {
		expect(isForbiddenRequestHeader("X-HTTP-Method-Override", "PATCH")).toBe(
			false,
		);
		expect(isForbiddenRequestHeader("X-HTTP-Method", "get, Trace")).toBe(true);
	});

	it("lists forbidden names once, in order", () => {
		expect(
			forbiddenHeaderNames([
				{ name: "Accept", value: "*/*" },
				{ name: "Cookie", value: "a=1" },
				{ name: "Host", value: "x" },
				{ name: "cookie", value: "b=2" },
			]),
		).toEqual(["Cookie", "Host"]);
	});
});

describe("hop-by-hop headers", () => {
	it("drops the fixed list and names listed in Connection", () => {
		const headers = [
			{ name: "Connection", value: "keep-alive, X-Private" },
			{ name: "Keep-Alive", value: "timeout=5" },
			{ name: "X-Private", value: "1" },
			{ name: "Transfer-Encoding", value: "chunked" },
			{ name: "Set-Cookie", value: "a=1" },
			{ name: "Set-Cookie", value: "b=2" },
			{ name: "Proxy-Authorization", value: "Basic x" },
		];
		expect(hopByHopNames(headers).has("x-private")).toBe(true);
		expect(stripHopByHop(headers)).toEqual([
			{ name: "Set-Cookie", value: "a=1" },
			{ name: "Set-Cookie", value: "b=2" },
		]);
	});
});

describe("header syntax", () => {
	it("accepts RFC 9110 token names only", () => {
		expect(isValidHeaderName("X-Custom_1.v")).toBe(true);
		expect(isValidHeaderName("Bad Name")).toBe(false);
		expect(isValidHeaderName("Bad:Name")).toBe(false);
		expect(isValidHeaderName("")).toBe(false);
		expect(isValidHeaderName("Tên")).toBe(false);
	});

	it("rejects CR, LF and NUL in values", () => {
		expect(isValidHeaderValue("a b ; c")).toBe(true);
		expect(isValidHeaderValue("a\r\nX-Evil: 1")).toBe(false);
		expect(isValidHeaderValue("a\0")).toBe(false);
	});
});
