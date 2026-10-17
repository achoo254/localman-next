import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const DEVELOPMENT = {
	MONGO_URI: "mongodb://localhost:27017/localman?replicaSet=rs0",
	OIDC_ISSUER: "http://localhost:3000",
	OIDC_CLIENT_SECRET: "client-secret-value",
	SESSION_ENCRYPTION_KEY: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
};
const PRODUCTION = {
	...DEVELOPMENT,
	NODE_ENV: "production",
	OIDC_ISSUER: "https://auth.hoandat.com",
	PUBLIC_URL: "https://localman.hoandat.com",
	WEB_ORIGIN: "https://localman.hoandat.com",
	TURNSTILE_SITE_KEY: "0x4AAA-site",
	TURNSTILE_SECRET_KEY: "0x4AAA-secret-hunter5",
};

describe("TUNELO_API_URL", () => {
	it("takes http in development (local Tunelo, E2E fake)", () => {
		const env = parseEnv({
			...DEVELOPMENT,
			TUNELO_API_URL: "http://127.0.0.1:4660",
		});
		expect(env.TUNELO_API_URL).toBe("http://127.0.0.1:4660");
	});

	it("must be https in production, where every tenant's tokens go there", () => {
		expect(() =>
			parseEnv({ ...PRODUCTION, TUNELO_API_URL: "http://tunnel.example.com" }),
		).toThrow(/TUNELO_API_URL/);
		const env = parseEnv({
			...PRODUCTION,
			TUNELO_API_URL: "https://tunnel.example.com",
		});
		expect(env.TUNELO_API_URL).toBe("https://tunnel.example.com");
		expect(parseEnv(PRODUCTION).TUNELO_API_URL).toBeUndefined();
	});
});
