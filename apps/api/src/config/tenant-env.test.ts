import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env.js";

const REQUIRED = {
	MONGO_URI: "mongodb://localhost:27017/localman?replicaSet=rs0",
	OIDC_ISSUER: "http://localhost:3000",
	OIDC_CLIENT_SECRET: "client-secret-value",
	SESSION_ENCRYPTION_KEY: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
};
const SECRET = "i".repeat(40);
const TENANTS = {
	IDP_INTERNAL_URL: "http://127.0.0.1:4501/",
	IDP_INTERNAL_SECRET: SECRET,
	IDP_LOOPBACK_URL: "http://127.0.0.1:4500",
	LOCALMAN_CLIENT_KEY: "k".repeat(43),
};

function errorOf(source: NodeJS.ProcessEnv): string {
	try {
		parseEnv(source);
		return "";
	} catch (error) {
		return error instanceof EnvError ? error.message : "";
	}
}

describe("tenant settings", () => {
	it("go together, and the secret is never echoed", () => {
		const message = errorOf({ ...REQUIRED, IDP_INTERNAL_SECRET: SECRET });
		expect(message).toMatch(/IDP_INTERNAL_URL: .*go together/);
		expect(message).not.toContain(SECRET);
		const env = parseEnv({ ...REQUIRED, ...TENANTS });
		expect(env.IDP_INTERNAL_URL).toBe("http://127.0.0.1:4501");
		expect(env.IDP_LOOPBACK_URL).toBe("http://127.0.0.1:4500");
	});

	it("reach the IdP's loopback listener over plain http only", () => {
		expect(
			errorOf({
				...REQUIRED,
				...TENANTS,
				IDP_LOOPBACK_URL: "https://127.0.0.1",
			}),
		).toMatch(/IDP_LOOPBACK_URL/);
	});
});
