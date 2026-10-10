import { describe, expect, it } from "vitest";
import {
	checkUpstream,
	draftOf,
	isPublicHttpsUrl,
	parsePort,
} from "./upstream-form-state";

describe("upstream form state", () => {
	it("reads ports 1-65535 only", () => {
		expect(parsePort(" 3000 ")).toBe(3000);
		expect(parsePort("65535")).toBe(65_535);
		for (const bad of ["", "0", "65536", "3.5", "-1", "30a", "1e3"]) {
			expect(parsePort(bad), bad).toBeNull();
		}
	});

	it("accepts https base URLs without credentials, query or fragment", () => {
		expect(isPublicHttpsUrl("https://staging.example.com/api")).toBe(true);
		for (const bad of [
			"http://staging.example.com",
			"https://user:pw@example.com",
			"https://example.com/?a=1",
			"https://example.com/#x",
			"staging.example.com",
		]) {
			expect(isPublicHttpsUrl(bad), bad).toBe(false);
		}
	});

	it("turns a valid draft into the upstream to save", () => {
		expect(checkUpstream({ kind: "none", port: "x", baseUrl: "" })).toEqual({
			ok: true,
			upstream: { kind: "none" },
		});
		expect(
			checkUpstream({ kind: "tunnel", port: "8080", baseUrl: "" }),
		).toEqual({
			ok: true,
			upstream: { kind: "tunnel", port: 8080 },
		});
		expect(
			checkUpstream({ kind: "url", port: "", baseUrl: " https://a.example " }),
		).toEqual({
			ok: true,
			upstream: { kind: "url", baseUrl: "https://a.example" },
		});
		expect(checkUpstream({ kind: "tunnel", port: "0", baseUrl: "" })).toEqual({
			ok: false,
			field: "port",
		});
		expect(
			checkUpstream({ kind: "url", port: "", baseUrl: "ftp://a" }),
		).toEqual({
			ok: false,
			field: "baseUrl",
		});
	});

	it("starts from the saved upstream", () => {
		expect(draftOf({ kind: "tunnel", port: 3000 })).toEqual({
			kind: "tunnel",
			port: "3000",
			baseUrl: "",
		});
		expect(draftOf({ kind: "url", baseUrl: "https://a.example" })).toEqual({
			kind: "url",
			port: "",
			baseUrl: "https://a.example",
		});
	});
});
