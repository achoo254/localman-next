import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env.js";

const REQUIRED = {
	MONGO_URI:
		"mongodb://localhost:27017/localman?replicaSet=rs0&directConnection=true",
	OIDC_ISSUER: "http://localhost:3000",
	OIDC_CLIENT_SECRET: "client-secret-value",
	SESSION_ENCRYPTION_KEY: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
};
const FINGERPRINT = Array.from({ length: 32 }, () => "ab").join(":");

describe("native app settings in the environment", () => {
	it("leaves the mobile sign-in off when unset", () => {
		const env = parseEnv(REQUIRED);
		expect(env.MOBILE_IOS_TEAM_ID).toBeUndefined();
		expect(env.MOBILE_ANDROID_CERT_SHA256).toEqual([]);
	});

	it("reads the Team ID and the fingerprints, upper-cased", () => {
		const env = parseEnv({
			...REQUIRED,
			MOBILE_IOS_TEAM_ID: "AM5C55N339",
			MOBILE_ANDROID_CERT_SHA256: ` ${FINGERPRINT}, ,${FINGERPRINT.replaceAll("ab", "01")}`,
		});
		expect(env.MOBILE_IOS_TEAM_ID).toBe("AM5C55N339");
		expect(env.MOBILE_ANDROID_CERT_SHA256).toEqual([
			FINGERPRINT.toUpperCase(),
			FINGERPRINT.replaceAll("ab", "01"),
		]);
	});

	it("refuses malformed values without echoing them", () => {
		for (const bad of [
			{ MOBILE_IOS_TEAM_ID: "am5c55n339" },
			{ MOBILE_IOS_TEAM_ID: "AM5C55N339.com.x" },
			{ MOBILE_ANDROID_CERT_SHA256: "AB:CD" },
		]) {
			expect(() => parseEnv({ ...REQUIRED, ...bad })).toThrow(EnvError);
			try {
				parseEnv({ ...REQUIRED, ...bad });
			} catch (error) {
				const message = error instanceof Error ? error.message : "";
				expect(message).not.toContain(Object.values(bad)[0]);
			}
		}
	});
});
