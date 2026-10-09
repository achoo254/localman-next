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

describe("HOST", () => {
	it("binds to loopback in production, behind nginx", () => {
		expect(parseEnv(PRODUCTION).HOST).toBe("127.0.0.1");
	});

	it("keeps every interface in development unless set", () => {
		expect(parseEnv(DEVELOPMENT).HOST).toBeUndefined();
		expect(parseEnv({ ...DEVELOPMENT, HOST: "0.0.0.0" }).HOST).toBe("0.0.0.0");
		expect(parseEnv({ ...PRODUCTION, HOST: "::1" }).HOST).toBe("::1");
	});

	it("refuses anything but an address or a host name", () => {
		expect(() => parseEnv({ ...DEVELOPMENT, HOST: "a b" })).toThrow(/HOST:/);
		expect(() => parseEnv({ ...DEVELOPMENT, HOST: "http://x" })).toThrow(
			/HOST:/,
		);
	});
});
