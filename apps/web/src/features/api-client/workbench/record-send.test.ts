import { describe, expect, it } from "vitest";
import { redirectedTo } from "./record-send";

describe("the final URL kept in history", () => {
	it("is left out without a redirect: it is the sent URL", () => {
		const url = "https://api.example.com/keys/one?page=2";
		expect(redirectedTo(url, url, url)).toBeUndefined();
	});

	it("keeps where a redirect of a URL sent as written ended, without its query", () => {
		const url = "https://api.example.com/old?page=2";
		expect(
			redirectedTo(url, url, "https://cdn.example.com/new?page=2#part"),
		).toBe("https://cdn.example.com/new");
	});

	it("is left out after a redirect once a variable was filled in", () => {
		// The redirect repeats the filled-in value (http to https, trailing slash).
		expect(
			redirectedTo(
				"http://api.example.com/bot{{botKey}}/getMe",
				"http://api.example.com/botfilled-value/getMe",
				"https://api.example.com/botfilled-value/getMe/",
			),
		).toBeUndefined();
	});

	it("is left out when only the query changed, or a URL does not parse", () => {
		const url = "https://a.example/p?x=1";
		expect(redirectedTo(url, url, "https://a.example/p?x=2")).toBeUndefined();
		expect(
			redirectedTo("not a url", "not a url", "https://a.example/p"),
		).toBeUndefined();
	});
});
