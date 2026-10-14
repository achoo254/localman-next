import { describe, expect, it } from "vitest";
import type { KeyValueRow } from "../request-model.js";
import {
	paramsFromUrl,
	queryMatchesParams,
	urlWithParams,
} from "./query-pairs.js";

let counter = 0;
const newId = () => `id${++counter}`;
const row = (key: string, value: string, enabled = true): KeyValueRow => ({
	id: `r-${key}`,
	key,
	value,
	enabled,
});

describe("urlWithParams", () => {
	it("rebuilds the query from enabled params and keeps the fragment", () => {
		const url = urlWithParams("https://a.test/users?old=1#top", [
			row("page", "2"),
			row("off", "x", false),
			row("q", "a b&c"),
		]);
		expect(url).toBe("https://a.test/users?page=2&q=a%20b%26c#top");
	});

	it("keeps {{variables}} readable and drops the query when no param is left", () => {
		expect(urlWithParams("{{baseUrl}}/u", [row("token", "{{token}}")])).toBe(
			"{{baseUrl}}/u?token={{token}}",
		);
		expect(urlWithParams("https://a.test/u?x=1", [])).toBe("https://a.test/u");
		expect(urlWithParams("https://a.test/u?flag", [row("flag", "")])).toBe(
			"https://a.test/u?flag",
		);
	});
});

describe("paramsFromUrl", () => {
	it("parses the query, reusing ids and descriptions by position, then keeps disabled rows", () => {
		const previous = [
			{ ...row("a", "1"), description: "first" },
			row("hidden", "z", false),
		];
		const params = paramsFromUrl("https://a.test/?a=2&b=3", previous, newId);
		expect(params).toEqual([
			{ id: "r-a", key: "a", value: "2", enabled: true, description: "first" },
			expect.objectContaining({ key: "b", value: "3", enabled: true }),
			row("hidden", "z", false),
		]);
	});

	it("round-trips with urlWithParams", () => {
		const url = "https://a.test/p?q=hello%20world&id={{id}}";
		const params = paramsFromUrl(url, [], newId);
		expect(urlWithParams(url, params)).toBe(url);
	});
});

describe("query text as typed", () => {
	const typed = "https://a.test/p?wsdl&path=~/x,y&q=a+b&sig=%7Ezz#top";

	it("round-trips every pair as typed when no param changed", () => {
		const params = paramsFromUrl(typed, [], newId);
		expect(queryMatchesParams(typed, params)).toBe(true);
		expect(urlWithParams(typed, params)).toBe(typed);
	});

	it("re-encodes only the param that was edited", () => {
		const params = paramsFromUrl(typed, [], newId).map((param) =>
			param.key === "q" ? { ...param, value: "c d" } : param,
		);
		expect(urlWithParams(typed, params)).toBe(
			"https://a.test/p?wsdl&path=~/x,y&q=c%20d&sig=%7Ezz#top",
		);
	});

	it("keeps a removed pair out and the others as typed", () => {
		const params = paramsFromUrl(typed, [], newId).filter(
			(param) => param.key !== "path",
		);
		expect(urlWithParams(typed, params)).toBe(
			"https://a.test/p?wsdl&q=a+b&sig=%7Ezz#top",
		);
	});
});
