import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env.js";

const MONGO_URI =
	"mongodb://localhost:27017/localman?replicaSet=rs0&directConnection=true";

describe("parseEnv", () => {
	it("applies defaults around a valid MONGO_URI", () => {
		expect(parseEnv({ MONGO_URI })).toEqual({
			NODE_ENV: "development",
			DASHBOARD_PORT: 4000,
			MOCK_PORT: 4100,
			MONGO_URI,
			WEB_ORIGIN: "http://localhost:5173",
			LOG_LEVEL: "info",
		});
	});

	it("coerces ports and treats empty values as unset", () => {
		const env = parseEnv({
			MONGO_URI,
			DASHBOARD_PORT: "5000",
			MOCK_PORT: "5100",
			LOG_LEVEL: "",
		});
		expect(env.DASHBOARD_PORT).toBe(5000);
		expect(env.MOCK_PORT).toBe(5100);
		expect(env.LOG_LEVEL).toBe("info");
	});

	it("fails clearly when MONGO_URI is missing", () => {
		expect(() => parseEnv({})).toThrow(EnvError);
		expect(() => parseEnv({})).toThrow(/MONGO_URI: is required/);
	});

	it("rejects malformed values and names each variable", () => {
		let message = "";
		try {
			parseEnv({
				MONGO_URI: "postgres://user:hunter2@db/x",
				DASHBOARD_PORT: "99999",
				WEB_ORIGIN: "ftp://example.com",
				LOG_LEVEL: "loud",
				NODE_ENV: "staging",
			});
		} catch (error) {
			message = error instanceof Error ? error.message : "";
		}
		for (const name of [
			"MONGO_URI",
			"DASHBOARD_PORT",
			"WEB_ORIGIN",
			"LOG_LEVEL",
			"NODE_ENV",
		]) {
			expect(message).toContain(`${name}:`);
		}
		expect(message).not.toContain("hunter2");
	});

	it("rejects identical dashboard and mock ports", () => {
		expect(() =>
			parseEnv({ MONGO_URI, DASHBOARD_PORT: "4000", MOCK_PORT: "4000" }),
		).toThrow(/MOCK_PORT: must differ from DASHBOARD_PORT/);
	});
});
