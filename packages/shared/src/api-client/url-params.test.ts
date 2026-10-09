import { describe, expect, it } from "vitest";
import {
	appendQueryParams,
	buildUrlWithParams,
	normalizeRequestUrl,
	parseHttpUrl,
	parseQueryFromUrl,
} from "./url-params.js";

let counter = 0;
const newId = (): string => `id-${++counter}`;

describe("url params (ported)", () => {
	it("parses query string to key-value pairs", () => {
		const pairs = parseQueryFromUrl(
			"https://api.example.com?foo=1&bar=hello",
			newId,
		);
		expect(pairs).toHaveLength(2);
		expect(pairs.find((p) => p.key === "foo")?.value).toBe("1");
		expect(pairs.find((p) => p.key === "bar")?.value).toBe("hello");
	});

	it("builds URL from params", () => {
		const params = [
			{ id: "1", key: "a", value: "1", enabled: true },
			{ id: "2", key: "b", value: "2", enabled: true },
			{ id: "3", key: "c", value: "x", enabled: false },
		];
		const url = buildUrlWithParams("https://api.example.com/path", params);
		expect(url).toBe("https://api.example.com/path?a=1&b=2");
	});
});

describe("url params", () => {
	it("keeps repeated keys, order, and a URL still holding {{var}}", () => {
		const pairs = parseQueryFromUrl("{{baseUrl}}/x?a=1&a=2&b={{v}}#top", newId);
		expect(pairs.map((p) => [p.key, p.value])).toEqual([
			["a", "1"],
			["a", "2"],
			["b", "{{v}}"],
		]);
		expect(pairs.every((p) => p.enabled && p.id)).toBe(true);
	});

	it("returns no params without a query", () => {
		expect(parseQueryFromUrl("https://x.test/a#q=1", newId)).toEqual([]);
	});

	it("replaces the query, encodes values and keeps the fragment", () => {
		const url = buildUrlWithParams("https://x.test/a?old=1#frag", [
			{ id: "1", key: " q ", value: "a b&c", enabled: true },
		]);
		expect(url).toBe("https://x.test/a?q=a+b%26c#frag");
	});

	it("drops the query when every param is disabled", () => {
		const url = buildUrlWithParams("https://x.test/a?q=1", [
			{ id: "1", key: "q", value: "1", enabled: false },
		]);
		expect(url).toBe("https://x.test/a");
	});

	it("leaves the URL untouched with no params at all", () => {
		expect(buildUrlWithParams("https://x.test/a?q=1#f", [])).toBe(
			"https://x.test/a?q=1#f",
		);
	});

	it("appends pairs to an existing query before the fragment", () => {
		expect(
			appendQueryParams("https://x.test/a?q=1#f", [
				{ key: "api key", value: "v&1" },
			]),
		).toBe("https://x.test/a?q=1&api+key=v%261#f");
		expect(
			appendQueryParams("https://x.test/a", [{ key: "k", value: "v" }]),
		).toBe("https://x.test/a?k=v");
	});

	it("adds http:// only when no scheme was typed", () => {
		expect(normalizeRequestUrl(" localhost:3000/users ")).toBe(
			"http://localhost:3000/users",
		);
		expect(normalizeRequestUrl("https://x.test")).toBe("https://x.test");
		expect(normalizeRequestUrl("")).toBe("");
	});

	it("accepts only absolute http(s) URLs", () => {
		expect(parseHttpUrl("https://x.test/a")?.hostname).toBe("x.test");
		expect(parseHttpUrl("ftp://x.test")).toBeNull();
		expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
		expect(parseHttpUrl("/relative")).toBeNull();
	});
});
