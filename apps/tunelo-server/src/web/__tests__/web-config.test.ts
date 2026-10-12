import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { loadWebConfig } from "../web-config.js";

const defaults = {
	issuer: "https://auth.hoandat.com",
	primaryDomain: "tunnel.hoandat.com",
};
const SECRET = "s3cret-value-long-enough-0123456789";
const KEY = randomBytes(32).toString("base64url");

describe("loadWebConfig", () => {
	test("enabled with defaults when the secret and key are set", () => {
		const result = loadWebConfig(
			{ TUNELO_WEB_CLIENT_SECRET: SECRET, WEB_SESSION_KEY: KEY },
			defaults,
		);
		expect(result.enabled).toBe(true);
		if (!result.enabled) return;
		expect(result.config.clientId).toBe("tunelo-web");
		expect(result.config.publicUrl).toBe("https://tunnel.hoandat.com");
		expect(result.config.sessionKey).toHaveLength(32);
		expect(result.config.issuer).toBe(defaults.issuer);
	});

	test("disabled, naming the missing variables only", () => {
		const result = loadWebConfig({ TUNELO_WEB_CLIENT_SECRET: " " }, defaults);
		expect(result).toEqual({
			enabled: false,
			missing: ["TUNELO_WEB_CLIENT_SECRET", "WEB_SESSION_KEY"],
			invalid: [],
		});
	});

	test("disabled on unusable values, which are never echoed", () => {
		const result = loadWebConfig(
			{
				TUNELO_WEB_CLIENT_SECRET: SECRET,
				WEB_SESSION_KEY: "dG9vLXNob3J0",
				TUNELO_WEB_PUBLIC_URL: "http://tunnel.hoandat.com/console",
			},
			defaults,
		);
		expect(result).toEqual({
			enabled: false,
			missing: [],
			invalid: ["TUNELO_WEB_PUBLIC_URL", "WEB_SESSION_KEY"],
		});
		expect(JSON.stringify(result)).not.toContain("dG9vLXNob3J0");
	});

	test("accepts an explicit https origin (trailing slash trimmed) or localhost http", () => {
		for (const [value, expected] of [
			["https://tunnel.example.com/", "https://tunnel.example.com"],
			["http://localhost:3001", "http://localhost:3001"],
		]) {
			const result = loadWebConfig(
				{
					TUNELO_WEB_CLIENT_SECRET: SECRET,
					WEB_SESSION_KEY: KEY,
					TUNELO_WEB_PUBLIC_URL: value,
				},
				defaults,
			);
			expect(result.enabled && result.config.publicUrl).toBe(expected);
		}
	});
});
