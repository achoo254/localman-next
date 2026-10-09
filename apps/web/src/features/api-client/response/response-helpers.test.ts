import type { ClientResponse } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { findMatches, splitByMatches } from "./body-search";
import { highlightJson } from "./json-highlight";
import {
	bodyFileName,
	formatBytes,
	prettyJson,
	previewKindOf,
	statusTone,
} from "./response-content";
import { cookiesFromHeaders, parseSetCookie } from "./set-cookie-parser";

function response(overrides: Partial<ClientResponse> = {}): ClientResponse {
	return {
		status: 200,
		statusText: "OK",
		headers: [],
		body: "",
		bodyEncoding: "utf8",
		size: 0,
		timings: { dns: 1, connect: 2, tls: 3, ttfb: 10, total: 12 },
		finalUrl: "https://api.example.com/users",
		truncated: false,
		...overrides,
	};
}

describe("statusTone", () => {
	it.each([
		[200, "success"],
		[204, "success"],
		[301, "info"],
		[404, "warning"],
		[503, "danger"],
		[99, "neutral"],
	] as const)("tones %i as %s", (status, tone) => {
		expect(statusTone(status)).toBe(tone);
	});
});

describe("body search", () => {
	it("finds literal, case-insensitive matches with their positions", () => {
		const text = 'a.b A.B "a.b"';
		const matches = findMatches(text, "a.b");
		expect(matches).toEqual([
			{ start: 0, end: 3 },
			{ start: 4, end: 7 },
			{ start: 9, end: 12 },
		]);
		expect(splitByMatches(text, matches).map((s) => s.match)).toEqual([
			0,
			null,
			1,
			null,
			2,
			null,
		]);
	});

	it("finds nothing for a blank query and stops at the cap", () => {
		expect(findMatches("aaa", "  ")).toEqual([]);
		expect(findMatches("a".repeat(50), "a", 5)).toHaveLength(5);
	});
});

describe("response content", () => {
	it("pretty-prints JSON and leaves other text alone", () => {
		expect(prettyJson('{"a":[1,true]}')).toBe(
			'{\n  "a": [\n    1,\n    true\n  ]\n}',
		);
		expect(prettyJson("<p>hi</p>")).toBeNull();
		expect(prettyJson("")).toBeNull();
	});

	it("colours keys, strings, numbers and literals of JSON", () => {
		const kinds = highlightJson('{"id": 1, "ok": null, "n": "x"}')
			.filter((token) => token.kind !== "plain")
			.map((token) => `${token.kind}:${token.text}`);
		expect(kinds).toEqual([
			'key:"id"',
			"number:1",
			'key:"ok"',
			"literal:null",
			'key:"n"',
			'string:"x"',
		]);
	});

	it("chooses the preview by media type", () => {
		const html = response({
			headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
		});
		const image = response({
			headers: [{ name: "content-type", value: "image/png" }],
			bodyEncoding: "base64",
		});
		expect(previewKindOf(html, false)).toBe("html");
		expect(previewKindOf(image, false)).toBe("image");
		expect(previewKindOf(response(), true)).toBe("json");
		expect(previewKindOf(response(), false)).toBe("none");
	});

	it("names the saved file after the URL and media type", () => {
		const json = response({
			headers: [{ name: "Content-Type", value: "application/json" }],
		});
		expect(bodyFileName(json)).toBe("users.json");
		expect(bodyFileName(response({ finalUrl: "https://x.test/" }))).toBe(
			"response.bin",
		);
		expect(
			bodyFileName(response({ finalUrl: "https://x.test/files/report.pdf" })),
		).toBe("report.pdf");
	});

	it("formats sizes with the language's numbers", () => {
		const plain = (n: number) => String(n);
		expect(formatBytes(312, plain)).toBe("312 B");
		expect(formatBytes(1536, plain)).toBe("1.5 KB");
		expect(formatBytes(10 * 1024 * 1024, plain)).toBe("10 MB");
	});
});

describe("Set-Cookie parsing", () => {
	it("reads attributes and defaults domain and path from the URL", () => {
		const cookie = parseSetCookie(
			"sid=a=b; Path=/app; Max-Age=60; HttpOnly; Secure; SameSite=Lax",
			"https://api.example.com/v1/users",
		);
		expect(cookie).toEqual({
			name: "sid",
			value: "a=b",
			domain: "api.example.com",
			path: "/app",
			expires: null,
			maxAge: 60,
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
		});
		expect(parseSetCookie("theme=dark", "https://x.test/a/b")?.path).toBe("/a");
	});

	it("keeps every Set-Cookie in order and skips invalid ones", () => {
		const cookies = cookiesFromHeaders(
			[
				{ name: "Set-Cookie", value: "a=1; Domain=.example.com" },
				{ name: "Content-Type", value: "text/plain" },
				{ name: "set-cookie", value: "=nameless" },
				{
					name: "set-cookie",
					value: "b=2; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
				},
			],
			"https://api.example.com/",
		);
		expect(cookies.map((c) => [c.name, c.domain, c.expires])).toEqual([
			["a", "example.com", null],
			["b", "api.example.com", "Wed, 21 Oct 2026 07:28:00 GMT"],
		]);
	});
});
