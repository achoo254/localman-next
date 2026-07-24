import { describe, expect, test } from "vitest";
import { isApiPath, normalizeAcceptEncoding } from "../asset-rules.js";
import {
	classifyResponse,
	isCacheableRequest,
	isLookupEligible,
} from "../cacheability.js";

const config = { maxTtlSeconds: 86_400 };

function classify(
	path: string,
	headers: Record<string, string | string[]>,
	status = 200,
) {
	return classifyResponse(path, status, headers, config);
}

const IMMUTABLE_JS = {
	"content-type": "application/javascript",
	"content-length": "1000",
	"cache-control": "public, max-age=31536000, immutable",
};

describe("request eligibility", () => {
	test("GET without auth is cacheable/lookup eligible", () => {
		expect(isCacheableRequest("GET", false)).toBe(true);
		expect(isLookupEligible("GET", "/app.js", false)).toBe(true);
	});

	test("auth'd GET is never eligible (would bypass Basic Auth)", () => {
		expect(isCacheableRequest("GET", true)).toBe(false);
		expect(isLookupEligible("GET", "/app.js", true)).toBe(false);
	});

	test("non-GET is never eligible", () => {
		expect(isCacheableRequest("POST", false)).toBe(false);
		expect(isCacheableRequest("HEAD", false)).toBe(false);
	});

	test("API paths skip lookup but plain assets do not", () => {
		expect(isLookupEligible("GET", "/api/users", false)).toBe(false);
		expect(isLookupEligible("GET", "/assets/x.js", false)).toBe(true);
	});
});

describe("isApiPath", () => {
	test.each([
		["/api", true],
		["/api/users", true],
		["/graphql", true],
		["/_next/data/build/page.json", true],
		["/socket.io/?EIO=4", true],
		["/apitest", false],
		["/assets/index.js", false],
		["/", false],
	])("%s → %s", (path, expected) => {
		expect(isApiPath(path)).toBe(expected);
	});
});

describe("classifyResponse — cacheable FE assets", () => {
	test("immutable hashed JS is cacheable, ttl capped at maxTtl", () => {
		const d = classify("/assets/index-abc.js", IMMUTABLE_JS);
		expect(d.cacheable).toBe(true);
		expect(d.ttl).toBe(86_400);
	});

	test("respects origin max-age when below cap", () => {
		const d = classify("/logo.png", {
			"content-type": "image/png",
			"content-length": "500",
			"cache-control": "public, max-age=600",
		});
		expect(d).toEqual({ cacheable: true, ttl: 600 });
	});

	test("classifies by extension when content-type is generic", () => {
		const d = classify("/font.woff2", {
			"content-type": "application/octet-stream",
			"content-length": "500",
			"cache-control": "max-age=3600",
		});
		expect(d.cacheable).toBe(true);
	});

	test("detects headers case-insensitively", () => {
		const d = classify("/a.css", {
			"Content-Type": "text/css",
			"Content-Length": "10",
			"Cache-Control": "max-age=100",
		});
		expect(d.cacheable).toBe(true);
	});
});

describe("classifyResponse — dev-first bypass", () => {
	test("same asset with no-cache (dev server) → bypass", () => {
		const d = classify("/src/main.tsx", {
			"content-type": "application/javascript",
			"content-length": "1000",
			"cache-control": "no-cache",
		});
		expect(d.cacheable).toBe(false);
	});

	test("asset without any cache header → bypass (not force-cached)", () => {
		const d = classify("/app.js", {
			"content-type": "application/javascript",
			"content-length": "1000",
		});
		expect(d.cacheable).toBe(false);
	});

	test("no-store / private / max-age=0 → bypass", () => {
		for (const cc of ["no-store", "private, max-age=60", "max-age=0"]) {
			expect(
				classify("/a.js", {
					"content-type": "application/javascript",
					"content-length": "1",
					"cache-control": cc,
				}).cacheable,
			).toBe(false);
		}
	});
});

describe("classifyResponse — API / dynamic always bypass", () => {
	test("application/json bypasses even if origin marks cacheable", () => {
		const d = classify("/data.js", {
			"content-type": "application/json",
			"content-length": "20",
			"cache-control": "public, max-age=3600",
		});
		expect(d.cacheable).toBe(false);
	});

	test("API path bypasses even with cacheable asset headers", () => {
		const d = classify("/api/config.js", IMMUTABLE_JS);
		expect(d.cacheable).toBe(false);
	});

	test("text/event-stream (SSE) bypasses", () => {
		const d = classify("/events", {
			"content-type": "text/event-stream",
			"content-length": "5",
			"cache-control": "max-age=60",
		});
		expect(d.cacheable).toBe(false);
	});

	test("missing content-length (chunked/stream) bypasses", () => {
		const d = classify("/a.js", {
			"content-type": "application/javascript",
			"cache-control": "max-age=60",
		});
		expect(d.cacheable).toBe(false);
	});

	test("Set-Cookie response bypasses (personalized)", () => {
		const d = classify("/a.js", {
			"content-type": "application/javascript",
			"content-length": "10",
			"cache-control": "max-age=60",
			"set-cookie": "sid=abc",
		});
		expect(d.cacheable).toBe(false);
	});

	test("non-200 status bypasses", () => {
		expect(classify("/a.js", IMMUTABLE_JS, 302).cacheable).toBe(false);
		expect(classify("/a.js", IMMUTABLE_JS, 500).cacheable).toBe(false);
	});

	test("HTML shell is never cached (kept fresh)", () => {
		const d = classify("/", {
			"content-type": "text/html; charset=utf-8",
			"content-length": "2000",
			"cache-control": "max-age=600",
		});
		expect(d.cacheable).toBe(false);
	});

	test("fractional max-age is floored", () => {
		const d = classify("/a.js", {
			"content-type": "application/javascript",
			"content-length": "10",
			"cache-control": "max-age=60.9",
		});
		expect(d).toEqual({ cacheable: true, ttl: 60 });
	});
});

describe("content-hashed auto-cache (no origin headers needed)", () => {
	const jsNoCC = {
		"content-type": "application/javascript",
		"content-length": "100",
	};

	test("Vite-style hashed asset cached without Cache-Control", () => {
		expect(classify("/assets/index-DqxaS-SZ.js", jsNoCC)).toEqual({
			cacheable: true,
			ttl: 86_400,
		});
	});

	test("webpack-style hashed asset (digits) cached without Cache-Control", () => {
		expect(classify("/static/main.a1b2c3d4.js", jsNoCC).cacheable).toBe(true);
	});

	test("hashed asset with no-cache is still cached (content-addressed)", () => {
		expect(
			classify("/assets/index-DqxaS-SZ.js", {
				...jsNoCC,
				"cache-control": "no-cache",
			}).cacheable,
		).toBe(true);
	});

	test("hashed asset honors a smaller origin max-age", () => {
		expect(
			classify("/assets/index-DqxaS-SZ.css", {
				"content-type": "text/css",
				"content-length": "10",
				"cache-control": "max-age=120",
			}),
		).toEqual({ cacheable: true, ttl: 120 });
	});

	test("hashed asset with no-store/private still bypasses", () => {
		for (const cc of ["no-store", "private"]) {
			expect(
				classify("/assets/index-DqxaS-SZ.js", {
					...jsNoCC,
					"cache-control": cc,
				}).cacheable,
			).toBe(false);
		}
	});

	test("plain-word filenames are NOT treated as hashed (stay fresh)", () => {
		expect(classify("/my-component.js", jsNoCC).cacheable).toBe(false);
		expect(classify("/dashboard.js", jsNoCC).cacheable).toBe(false);
	});
});

describe("Vary handling", () => {
	test("Vary: Accept-Encoding stays cacheable (we key on encoding)", () => {
		const d = classify("/a.js", {
			"content-type": "application/javascript",
			"content-length": "10",
			"cache-control": "max-age=60",
			vary: "Accept-Encoding",
		});
		expect(d.cacheable).toBe(true);
	});

	test("Vary on any other dimension bypasses", () => {
		for (const vary of [
			"Cookie",
			"User-Agent",
			"Accept-Encoding, Cookie",
			"*",
		]) {
			expect(
				classify("/a.js", {
					"content-type": "application/javascript",
					"content-length": "10",
					"cache-control": "max-age=60",
					vary,
				}).cacheable,
			).toBe(false);
		}
	});
});

describe("normalizeAcceptEncoding", () => {
	test.each([
		["br, gzip, deflate", "br"],
		["gzip, deflate", "gzip"],
		["gzip", "gzip"],
		["deflate", "identity"],
		["", "identity"],
	])("%s → %s", (input, expected) => {
		expect(normalizeAcceptEncoding(input)).toBe(expected);
	});
});
