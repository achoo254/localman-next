import { describe, expect, it } from "vitest";
import { endpointRuleSchema } from "./endpoint-behavior.js";
import { isRuleHeaderName, ruleHeaderIssue } from "./rule-headers.js";

const rule = (status: number, headers: { name: string; value: string }[]) => ({
	match: { source: "nth" },
	op: "eq",
	value: 1,
	response: { status, headers },
});

describe("rule header allowlist", () => {
	it.each([
		"x-reason",
		"x-ratelimit-remaining",
		"x-total-count",
		"retry-after",
		"cache-control",
		"etag",
		"last-modified",
		"expires",
		"content-language",
		"content-type",
		"location",
	])("allows %s", (name) => {
		expect(isRuleHeaderName(name)).toBe(true);
	});

	it.each([
		"x-localman-request-id",
		"x-request-id",
		"x-frame-options",
		"x-content-type-options",
		"x-forwarded-for",
		"nel",
		"report-to",
		"reporting-endpoints",
		"clear-site-data",
		"www-authenticate",
		"alt-svc",
		"link",
		"content-disposition",
		"set-cookie",
		"access-control-allow-origin",
		"cross-origin-opener-policy",
		"content-security-policy",
		"strict-transport-security",
		"connection",
		"transfer-encoding",
		"content-length",
		"refresh",
		"server",
	])("refuses %s", (name) => {
		expect(isRuleHeaderName(name)).toBe(false);
		expect(ruleHeaderIssue(name, "x", 200)).toBe("reserved");
	});

	it("only sends location with a 3xx status", () => {
		expect(ruleHeaderIssue("location", "/next", 302)).toBeNull();
		expect(ruleHeaderIssue("location", "/next", 399)).toBeNull();
		expect(ruleHeaderIssue("location", "/next", 200)).toBe("location");
		expect(ruleHeaderIssue("location", "/next", 400)).toBe("location");
	});

	it.each([
		["application/json", null],
		["application/problem+json; charset=utf-8", null],
		["application/vnd.api+json", null],
		["text/plain", null],
		["text/html", "contentType"],
		["application/javascript", "contentType"],
		["image/svg+xml", "contentType"],
		["application/+json", "contentType"],
		["application/x y+json", "contentType"],
	])("content-type %s → %s", (value, issue) => {
		expect(ruleHeaderIssue("content-type", value, 200)).toBe(issue);
	});

	it("is enforced by the rule schema with the response status", () => {
		const parse = (status: number, name: string, value: string) =>
			endpointRuleSchema.safeParse(rule(status, [{ name, value }])).success;
		expect(parse(200, "X-Reason", "role")).toBe(true);
		expect(parse(301, "Location", "/v2/users")).toBe(true);
		expect(parse(200, "Location", "/v2/users")).toBe(false);
		expect(parse(200, "Content-Type", "application/problem+json")).toBe(true);
		expect(parse(200, "Content-Type", "text/html")).toBe(false);
		expect(parse(200, "NEL", "{}")).toBe(false);
		expect(parse(200, "X-Forwarded-Host", "evil")).toBe(false);
	});
});
