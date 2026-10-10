import { describe, expect, it } from "vitest";
import { apiUrl, isSafeReturnPath, loginUrl, logoutUrl } from "./api-url";
import { parseApiBaseUrl, parseIdpOrigin } from "./app-config";

describe("api URLs", () => {
	it("builds login URLs with an encoded returnTo and optional prompt", () => {
		expect(loginUrl()).toBe("/auth/login");
		expect(loginUrl({ returnTo: "/projects?x=1 2" })).toBe(
			`/auth/login?returnTo=${encodeURIComponent("/projects?x=1 2")}`,
		);
		expect(loginUrl({ returnTo: "/projects", prompt: "create" })).toBe(
			"/auth/login?returnTo=%2Fprojects&prompt=create",
		);
		expect(logoutUrl()).toBe("/auth/logout");
	});

	it("passes the sign-in language on to the API", () => {
		expect(loginUrl({ locale: "zh-CN" })).toBe("/auth/login?locale=zh-CN");
		expect(loginUrl({ returnTo: "/projects", locale: "vi" })).toBe(
			"/auth/login?returnTo=%2Fprojects&locale=vi",
		);
	});

	it("drops returnTo values that could leave the site", () => {
		for (const path of ["//evil.example", "https://evil.example", "/\\evil"]) {
			expect(isSafeReturnPath(path)).toBe(false);
		}
		expect(loginUrl({ returnTo: "//evil.example" })).toBe("/auth/login");
	});

	it("rejects paths that are not root-relative", () => {
		expect(() => apiUrl("api/v1")).toThrow();
		expect(() => apiUrl("//host/api")).toThrow();
	});
});

describe("build config", () => {
	it("defaults to same-origin API and the hoandat IdP", () => {
		expect(parseApiBaseUrl(undefined)).toBe("");
		expect(parseApiBaseUrl("  ")).toBe("");
		expect(parseIdpOrigin(undefined)).toBe("https://auth.hoandat.com");
	});

	it("normalises configured origins and refuses malformed ones", () => {
		expect(parseApiBaseUrl("https://api.example.com/")).toBe(
			"https://api.example.com",
		);
		expect(parseIdpOrigin("http://localhost:3000/")).toBe(
			"http://localhost:3000",
		);
		expect(() => parseApiBaseUrl("api.example.com")).toThrow();
		expect(() => parseIdpOrigin("javascript:alert(1)")).toThrow();
	});
});
