import { describe, expect, test } from "vitest";
import { loadAuthConfig } from "../auth-config.js";
import {
	buildTunnelUrl,
	parseTunnelDomains,
	primaryTunnelDomain,
} from "../tunnel-domains.js";

describe("tunnel domains", () => {
	test("parses a list, primary first", () => {
		expect(
			parseTunnelDomains(" Tunnel.Hoandat.com , tunnel.inetdev.io.vn,"),
		).toEqual(["tunnel.hoandat.com", "tunnel.inetdev.io.vn"]);
	});

	test("rejects empty lists and bad hostnames", () => {
		expect(() => parseTunnelDomains(" , ")).toThrow();
		expect(() => parseTunnelDomains("bad_domain.com")).toThrow();
		expect(() => parseTunnelDomains("localhost")).toThrow();
	});

	test("URLs always use the primary domain", () => {
		expect(primaryTunnelDomain()).toBe("tunnel.hoandat.com");
		expect(buildTunnelUrl("demo")).toBe("https://demo.tunnel.hoandat.com");
	});
});

describe("auth config", () => {
	test("defaults to hybrid against auth.hoandat.com with no cutoff", () => {
		expect(loadAuthConfig({})).toEqual({
			mode: "hybrid",
			issuer: "https://auth.hoandat.com",
			audience: "https://tunnel.hoandat.com",
			legacyCutoffMs: null,
		});
	});

	test("reads mode, issuer and cutoff", () => {
		const config = loadAuthConfig({
			AUTH_MODE: "legacy",
			AUTH_ISSUER: "http://localhost:4400/",
			LEGACY_TOKEN_CUTOFF: "2026-12-08T00:00:00Z",
		});
		expect(config.mode).toBe("legacy");
		expect(config.issuer).toBe("http://localhost:4400");
		expect(config.legacyCutoffMs).toBe(Date.parse("2026-12-08T00:00:00Z"));
	});

	test("refuses invalid values", () => {
		expect(() => loadAuthConfig({ AUTH_MODE: "off" })).toThrow();
		expect(() =>
			loadAuthConfig({ AUTH_ISSUER: "http://auth.example" }),
		).toThrow();
		expect(() => loadAuthConfig({ LEGACY_TOKEN_CUTOFF: "soon" })).toThrow();
	});
});
