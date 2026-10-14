import { describe, expect, it } from "vitest";
import { isLiteralValue, isSensitiveName } from "./sensitive-names.js";

describe("isSensitiveName", () => {
	it.each([
		"Authorization",
		"Cookie",
		"Set-Cookie",
		"set-cookie",
		"WWW-Authenticate",
		"X-API-Key",
		"x-api-key",
		"apiKey",
		"api_key",
		"X-Auth-Token",
		"access_token",
		"client_secret",
		"password",
		"sig",
		"X-Hub-Signature",
		"X-Session-Id",
		"sessionid",
		"PHPSESSID",
		"jwt",
		"Authentication",
		"code_verifier",
	])("flags %s", (name) => {
		expect(isSensitiveName(name)).toBe(true);
	});

	it.each([
		"Content-Type",
		"Accept",
		"keyword",
		"author",
		"page",
		"Keep-Alive",
		"",
	])("leaves %s", (name) => {
		expect(isSensitiveName(name)).toBe(false);
	});
});

describe("isLiteralValue", () => {
	it("is false for empty values and values that use a {{var}}", () => {
		expect(isLiteralValue("sk_live_1")).toBe(true);
		expect(isLiteralValue("")).toBe(false);
		expect(isLiteralValue("{{token}}")).toBe(false);
		expect(isLiteralValue("Bearer {{token}}")).toBe(false);
		expect(isLiteralValue("{{a}}:{{b}}")).toBe(false);
	});

	it("is true for a value typed next to a {{var}}", () => {
		expect(isLiteralValue("sk_live_REAL{{suffix}}")).toBe(true);
		expect(isLiteralValue("session=abc; tenant={{tenant}}")).toBe(true);
		expect(isLiteralValue("{{prefix}}abc")).toBe(true);
		expect(isLiteralValue("Bearer x{{token}}")).toBe(true);
	});
});
