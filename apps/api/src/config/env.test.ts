import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env.js";

const MONGO_URI =
	"mongodb://localhost:27017/localman?replicaSet=rs0&directConnection=true";
const SESSION_KEY = `k1:${Buffer.alloc(32, 7).toString("base64")}`;
const REQUIRED = {
	MONGO_URI,
	OIDC_ISSUER: "http://localhost:3000",
	OIDC_CLIENT_SECRET: "client-secret-value",
	SESSION_ENCRYPTION_KEY: SESSION_KEY,
};

const TURNSTILE = {
	TURNSTILE_SITE_KEY: "0x4AAA-site",
	TURNSTILE_SECRET_KEY: "0x4AAA-secret-hunter5",
};

function errorOf(source: NodeJS.ProcessEnv): string {
	try {
		parseEnv(source);
	} catch (error) {
		return error instanceof Error ? error.message : "";
	}
	return "";
}

describe("parseEnv", () => {
	it("applies defaults around the required values", () => {
		expect(parseEnv(REQUIRED)).toEqual({
			NODE_ENV: "development",
			DASHBOARD_PORT: 4000,
			MOCK_PORT: 4100,
			MONGO_URI,
			WEB_ORIGIN: "http://localhost:5173",
			PUBLIC_URL: "http://localhost:5173",
			LOG_LEVEL: "info",
			OIDC_ISSUER: "http://localhost:3000",
			OIDC_CLIENT_ID: "localman-web",
			OIDC_CLIENT_SECRET: "client-secret-value",
			SESSION_ENCRYPTION_KEY: SESSION_KEY,
			TRUST_PROXY: "loopback",
			MOCK_BASE_DOMAIN: "localman.hoandat.com",
			MOCK_RATE_LIMIT_PER_SECRET: 60,
			MOCK_RATE_LIMIT_PER_IP: 30,
			MOCK_WRITE_RATE_LIMIT_PER_SECRET: 10,
			MOCK_RESPONSE_BYTES_PER_SECOND: 20 * 1024 * 1024,
			OWNER_SUBS: [],
			PROXY_BLOCKED_CIDRS: [],
			TUNNEL_DOMAINS: [],
			TURNSTILE_VERIFY_URL:
				"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		});
	});

	it("coerces ports and treats empty values as unset", () => {
		const env = parseEnv({
			...REQUIRED,
			DASHBOARD_PORT: "5000",
			MOCK_PORT: "5100",
			LOG_LEVEL: "",
			TELEGRAM_BOT_TOKEN: "",
		});
		expect(env.DASHBOARD_PORT).toBe(5000);
		expect(env.MOCK_PORT).toBe(5100);
		expect(env.LOG_LEVEL).toBe("info");
		expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
	});

	it("fails clearly when required values are missing", () => {
		expect(() => parseEnv({})).toThrow(EnvError);
		const message = errorOf({});
		for (const name of [
			"MONGO_URI",
			"OIDC_ISSUER",
			"OIDC_CLIENT_SECRET",
			"SESSION_ENCRYPTION_KEY",
		]) {
			expect(message).toContain(`${name}:`);
		}
	});

	it("rejects malformed values, names each variable and echoes no secret", () => {
		const message = errorOf({
			MONGO_URI: "postgres://user:hunter2@db/x",
			DASHBOARD_PORT: "99999",
			WEB_ORIGIN: "ftp://example.com",
			PUBLIC_URL: "https://localman.example/app",
			LOG_LEVEL: "loud",
			NODE_ENV: "staging",
			OIDC_ISSUER: "auth.example",
			OIDC_CLIENT_SECRET: "s3cret",
			SESSION_ENCRYPTION_KEY: "k1:tooshort-hunter3",
			TELEGRAM_BOT_TOKEN: "hunter4",
		});
		for (const name of [
			"MONGO_URI",
			"DASHBOARD_PORT",
			"WEB_ORIGIN",
			"PUBLIC_URL",
			"LOG_LEVEL",
			"NODE_ENV",
			"OIDC_ISSUER",
			"SESSION_ENCRYPTION_KEY",
			"TELEGRAM_BOT_TOKEN",
		]) {
			expect(message).toContain(`${name}:`);
		}
		for (const secret of ["hunter2", "hunter3", "hunter4", "s3cret"]) {
			expect(message).not.toContain(secret);
		}
	});

	it("reads the mock rate limits as positive integers", () => {
		const env = parseEnv({
			...REQUIRED,
			MOCK_RATE_LIMIT_PER_SECRET: "120",
			MOCK_RATE_LIMIT_PER_IP: "15",
			MOCK_WRITE_RATE_LIMIT_PER_SECRET: "5",
			MOCK_RESPONSE_BYTES_PER_SECOND: "1048576",
		});
		expect(env.MOCK_RATE_LIMIT_PER_SECRET).toBe(120);
		expect(env.MOCK_RATE_LIMIT_PER_IP).toBe(15);
		expect(env.MOCK_WRITE_RATE_LIMIT_PER_SECRET).toBe(5);
		expect(env.MOCK_RESPONSE_BYTES_PER_SECOND).toBe(1_048_576);
		expect(() =>
			parseEnv({ ...REQUIRED, MOCK_RESPONSE_BYTES_PER_SECOND: "1000" }),
		).toThrow(/MOCK_RESPONSE_BYTES_PER_SECOND/);
		for (const value of ["0", "-1", "1.5", "many"]) {
			expect(() =>
				parseEnv({ ...REQUIRED, MOCK_RATE_LIMIT_PER_IP: value }),
			).toThrow(/MOCK_RATE_LIMIT_PER_IP/);
		}
	});

	it("rejects identical dashboard and mock ports", () => {
		expect(() =>
			parseEnv({ ...REQUIRED, DASHBOARD_PORT: "4000", MOCK_PORT: "4000" }),
		).toThrow(/MOCK_PORT: must differ from DASHBOARD_PORT/);
	});

	it("requires https origins and issuer in production", () => {
		const message = errorOf({ ...REQUIRED, NODE_ENV: "production" });
		expect(message).toContain("PUBLIC_URL: must use https in production");
		expect(message).toContain("WEB_ORIGIN: must use https in production");
		expect(message).toContain("OIDC_ISSUER: must use https in production");
		const env = parseEnv({
			...REQUIRED,
			NODE_ENV: "production",
			OIDC_ISSUER: "https://auth.hoandat.com",
			PUBLIC_URL: "https://localman.hoandat.com/",
			WEB_ORIGIN: "https://localman.hoandat.com",
			...TURNSTILE,
		});
		expect(env.PUBLIC_URL).toBe("https://localman.hoandat.com");
	});

	it("keeps the VAPID keys together", () => {
		expect(errorOf({ ...REQUIRED, VAPID_PUBLIC_KEY: "BPub" })).toMatch(
			/VAPID_PUBLIC_KEY: .*go together/,
		);
		const env = parseEnv({
			...REQUIRED,
			VAPID_PUBLIC_KEY: "BPub",
			VAPID_PRIVATE_KEY: "priv",
			VAPID_SUBJECT: "mailto:ops@hoandat.com",
			TELEGRAM_BOT_TOKEN: "123456:ABC-def_ghi",
			TELEGRAM_BOT_USERNAME: "localman_bot",
		});
		expect(env.VAPID_SUBJECT).toBe("mailto:ops@hoandat.com");
		expect(env.TELEGRAM_BOT_USERNAME).toBe("localman_bot");
	});

	it("parses TRUST_PROXY like Express does and refuses unsafe values", () => {
		const trust = (value: string, extra: NodeJS.ProcessEnv = {}) =>
			parseEnv({ ...REQUIRED, ...extra, TRUST_PROXY: value }).TRUST_PROXY;
		expect(trust("false")).toBe(false);
		expect(trust("1")).toBe(1);
		expect(trust("loopback, 10.0.0.0/8")).toBe("loopback,10.0.0.0/8");
		expect(trust("127.0.0.1, ::1")).toBe("127.0.0.1,::1");
		for (const bad of ["true", "1.2.3.4/99", "foo", "10.0.0.1,", "300.1.1.1"]) {
			expect(errorOf({ ...REQUIRED, TRUST_PROXY: bad })).toContain(
				"TRUST_PROXY:",
			);
		}
		const production = {
			NODE_ENV: "production",
			OIDC_ISSUER: "https://auth.hoandat.com",
			PUBLIC_URL: "https://localman.hoandat.com",
			WEB_ORIGIN: "https://localman.hoandat.com",
			...TURNSTILE,
		};
		expect(errorOf({ ...REQUIRED, ...production, TRUST_PROXY: "1" })).toContain(
			"TRUST_PROXY: must name the proxy addresses in production",
		);
		expect(trust("127.0.0.1", production)).toBe("127.0.0.1");
	});

	it("keeps the audit credentials together", () => {
		expect(errorOf({ ...REQUIRED, AUDIT_CLIENT_ID: "idp" })).toMatch(
			/AUDIT_CLIENT_ID: .*go together/,
		);
		const secret = "s".repeat(40);
		const message = errorOf({
			...REQUIRED,
			AUDIT_CLIENT_ID: "bad:id",
			AUDIT_CLIENT_SECRET: secret,
		});
		expect(message).toContain("AUDIT_CLIENT_ID:");
		expect(message).not.toContain(secret);
	});

	it("keeps the IdP's internal API settings together, never echoing the secret", () => {
		const secret = "i".repeat(40);
		const message = errorOf({ ...REQUIRED, IDP_INTERNAL_SECRET: secret });
		expect(message).toMatch(/IDP_INTERNAL_URL: .*go together/);
		expect(message).not.toContain(secret);
		const env = parseEnv({
			...REQUIRED,
			IDP_INTERNAL_URL: "http://127.0.0.1:4501/",
			IDP_INTERNAL_SECRET: secret,
			IDP_LOOPBACK_URL: "http://127.0.0.1:4500",
			LOCALMAN_CLIENT_KEY: "k".repeat(43),
		});
		expect(env.IDP_INTERNAL_URL).toBe("http://127.0.0.1:4501");
		expect(env.IDP_LOOPBACK_URL).toBe("http://127.0.0.1:4500");
	});
});
