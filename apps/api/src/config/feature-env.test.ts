import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env.js";

const REQUIRED = {
	MONGO_URI:
		"mongodb://localhost:27017/localman?replicaSet=rs0&directConnection=true",
	OIDC_ISSUER: "http://localhost:3000",
	OIDC_CLIENT_SECRET: "client-secret-value",
	SESSION_ENCRYPTION_KEY: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
};
const TURNSTILE = {
	TURNSTILE_SITE_KEY: "0x4AAA-site",
	TURNSTILE_SECRET_KEY: "0x4AAA-secret-hunter5",
};

function errorOf(source: NodeJS.ProcessEnv): string {
	try {
		parseEnv(source);
	} catch (error) {
		return error instanceof EnvError ? error.message : "";
	}
	return "";
}

describe("product settings in the environment", () => {
	it("reads the product settings and requires Turnstile in production", () => {
		const env = parseEnv({
			...REQUIRED,
			MOCK_BASE_DOMAIN: "LocalHost:4100",
			OWNER_SUBS: " acc_1, ,acc_2 ",
			OWNER_TELEGRAM_CHAT_ID: "-100123",
		});
		expect(env.MOCK_BASE_DOMAIN).toBe("localhost:4100");
		expect(env.OWNER_SUBS).toEqual(["acc_1", "acc_2"]);
		expect(env.OWNER_TELEGRAM_CHAT_ID).toBe("-100123");
		for (const bad of [
			{ MOCK_BASE_DOMAIN: "https://x.com" },
			{ OWNER_TELEGRAM_CHAT_ID: "@me" },
			{ TURNSTILE_SITE_KEY: "only-site" },
		]) {
			expect(errorOf({ ...REQUIRED, ...bad })).toContain(
				`${Object.keys(bad)[0]}:`,
			);
		}
		const production = {
			...REQUIRED,
			NODE_ENV: "production",
			OIDC_ISSUER: "https://auth.hoandat.com",
			PUBLIC_URL: "https://localman.hoandat.com",
			WEB_ORIGIN: "https://localman.hoandat.com",
		};
		const message = errorOf(production);
		expect(message).toContain(
			"TURNSTILE_SECRET_KEY: is required in production",
		);
		expect(parseEnv({ ...production, ...TURNSTILE }).TURNSTILE_SITE_KEY).toBe(
			TURNSTILE.TURNSTILE_SITE_KEY,
		);
		const lonelySecret = errorOf({
			...REQUIRED,
			TURNSTILE_SECRET_KEY: TURNSTILE.TURNSTILE_SECRET_KEY,
		});
		expect(lonelySecret).toContain("TURNSTILE_SITE_KEY: ");
		expect(lonelySecret).not.toContain("hunter5");
	});

	it("refuses Cloudflare's testing Turnstile secret in production only", () => {
		const testing = {
			TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
			TURNSTILE_SECRET_KEY: `1x${"0".repeat(31)}AA`,
		};
		const production = {
			...REQUIRED,
			NODE_ENV: "production",
			OIDC_ISSUER: "https://auth.hoandat.com",
			PUBLIC_URL: "https://localman.hoandat.com",
			WEB_ORIGIN: "https://localman.hoandat.com",
		};
		expect(errorOf({ ...production, ...testing })).toContain(
			"TURNSTILE_SECRET_KEY: must not be a Cloudflare testing secret",
		);
		expect(parseEnv({ ...REQUIRED, ...testing }).TURNSTILE_SECRET_KEY).toBe(
			testing.TURNSTILE_SECRET_KEY,
		);
	});
});
