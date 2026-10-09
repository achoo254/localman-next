import { describe, expect, it } from "vitest";
import {
	allowAutoLoginRedirect,
	resetAutoLoginRedirects,
} from "./login-redirect-guard";

const KEY = "localman-login-redirects";

describe("login redirect guard", () => {
	it("allows two automatic redirects per minute, then refuses", () => {
		const t0 = 1_000_000;
		expect(allowAutoLoginRedirect(t0)).toBe(true);
		expect(allowAutoLoginRedirect(t0 + 1_000)).toBe(true);
		expect(allowAutoLoginRedirect(t0 + 2_000)).toBe(false);
		expect(allowAutoLoginRedirect(t0 + 59_999)).toBe(false);
	});

	it("starts a new window after 60 seconds", () => {
		const t0 = 1_000_000;
		allowAutoLoginRedirect(t0);
		allowAutoLoginRedirect(t0);
		expect(allowAutoLoginRedirect(t0 + 60_000)).toBe(true);
	});

	it("stores only a counter and a timestamp", () => {
		allowAutoLoginRedirect(42);
		expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? "")).toEqual({
			count: 1,
			since: 42,
		});
	});

	it("resets on demand and tolerates corrupt storage", () => {
		allowAutoLoginRedirect(1);
		allowAutoLoginRedirect(1);
		resetAutoLoginRedirects();
		expect(allowAutoLoginRedirect(2)).toBe(true);
		window.sessionStorage.setItem(KEY, "{not json");
		expect(allowAutoLoginRedirect(3)).toBe(true);
		window.sessionStorage.setItem(KEY, JSON.stringify({ count: "9" }));
		expect(allowAutoLoginRedirect(4)).toBe(true);
	});
});
