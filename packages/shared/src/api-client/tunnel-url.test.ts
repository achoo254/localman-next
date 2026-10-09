import { describe, expect, it } from "vitest";
import { isTunnelUrl, rewriteToTunnel } from "./tunnel-url.js";

const TUNNEL = "https://dat-shop.tunnel.hoandat.com";

describe("rewriteToTunnel", () => {
	it("keeps path, query and fragment", () => {
		expect(
			rewriteToTunnel(
				"http://localhost:3000/users/1?page=2&q=a%20b#top",
				TUNNEL,
			),
		).toBe("https://dat-shop.tunnel.hoandat.com/users/1?page=2&q=a%20b#top");
	});

	it("handles a bare root, no scheme and IPv6 loopback", () => {
		expect(rewriteToTunnel("http://127.0.0.1:8080", TUNNEL)).toBe(`${TUNNEL}/`);
		expect(rewriteToTunnel("localhost:5173/app?x=1", TUNNEL)).toBe(
			`${TUNNEL}/app?x=1`,
		);
		expect(rewriteToTunnel("http://[::1]:3000/a#b", TUNNEL)).toBe(
			`${TUNNEL}/a#b`,
		);
	});

	it("uses only the tunnel's origin, keeping its port", () => {
		expect(
			rewriteToTunnel(
				"http://localhost:3000/users",
				"https://user:pw@dat-shop.tunnel.hoandat.com/some/path?x=1#y",
			),
		).toBe(`${TUNNEL}/users`);
		expect(
			rewriteToTunnel("http://localhost:3000/a", "http://127.0.0.1:4040"),
		).toBe("http://127.0.0.1:4040/a");
	});

	it("drops credentials of the original URL", () => {
		expect(rewriteToTunnel("http://u:p@localhost:3000/a", TUNNEL)).toBe(
			`${TUNNEL}/a`,
		);
	});

	it("is null for invalid input", () => {
		expect(rewriteToTunnel("http://localhost:3000/a", "ftp://x")).toBeNull();
		expect(rewriteToTunnel("http://[bad", TUNNEL)).toBeNull();
	});
});

describe("isTunnelUrl", () => {
	it("accepts a single https subdomain of the Tunelo domain", () => {
		expect(isTunnelUrl(TUNNEL)).toBe(true);
		expect(isTunnelUrl(" https://abc123.TUNNEL.hoandat.com/x ")).toBe(true);
	});

	it.each([
		"http://dat-shop.tunnel.hoandat.com",
		"https://tunnel.hoandat.com",
		"https://a.b.tunnel.hoandat.com",
		"https://-bad.tunnel.hoandat.com",
		"https://dat-shop.tunnel.hoandat.com.evil.com",
		"https://evil-tunnel.hoandat.com",
		"https://example.com",
		"tunnel.hoandat.com",
	])("rejects %s", (url) => {
		expect(isTunnelUrl(url)).toBe(false);
	});

	it("accepts other domains when given", () => {
		expect(isTunnelUrl("https://x.tunnel.test", ["tunnel.test"])).toBe(true);
		expect(isTunnelUrl(TUNNEL, ["tunnel.test"])).toBe(false);
	});
});
