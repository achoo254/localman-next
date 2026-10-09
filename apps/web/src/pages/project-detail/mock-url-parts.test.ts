import { describe, expect, it } from "vitest";
import { splitMockBaseUrl } from "./mock-url-parts";

describe("splitMockBaseUrl", () => {
	it("separates scheme, secret, host and prefix", () => {
		expect(
			splitMockBaseUrl(
				"https://abc123.mock.localman.app/api/v1",
				"abc123",
				"/api/v1",
			),
		).toEqual({
			scheme: "https://",
			secret: "abc123",
			host: ".mock.localman.app",
			prefix: "/api/v1",
		});
	});

	it("handles projects without a prefix and local http hosts", () => {
		expect(splitMockBaseUrl("http://abc.localhost:4100/", "abc", "")).toEqual({
			scheme: "http://",
			secret: "abc",
			host: ".localhost:4100",
			prefix: "",
		});
	});

	it("shows the host whole when it does not start with the secret", () => {
		expect(splitMockBaseUrl("https://mock.example/x", "abc", "/x")).toEqual({
			scheme: "https://",
			secret: null,
			host: "mock.example",
			prefix: "/x",
		});
	});
});
