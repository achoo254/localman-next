import { describe, expect, it } from "vitest";
import { redirectedTo } from "./record-send";

describe("the final URL kept in history", () => {
	it("is left out without a redirect: it is the sent URL, variables filled", () => {
		const sent = "https://api.example.com/keys/s3cr3t-value?token=s3cr3t-value";
		expect(redirectedTo(sent, sent)).toBeUndefined();
	});

	it("keeps where a redirect ended, without its query", () => {
		expect(
			redirectedTo(
				"https://api.example.com/old?token=s3cr3t-value",
				"https://cdn.example.com/new?token=s3cr3t-value#part",
			),
		).toBe("https://cdn.example.com/new");
	});

	it("is left out when only the query changed, or a URL does not parse", () => {
		expect(
			redirectedTo("https://a.example/p?x=1", "https://a.example/p?x=2"),
		).toBeUndefined();
		expect(redirectedTo("not a url", "https://a.example/p")).toBeUndefined();
	});
});
