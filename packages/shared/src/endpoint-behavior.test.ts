import { describe, expect, it } from "vitest";
import {
	MAX_CHAOS_DELAY_MS,
	MAX_RULES_PER_ENDPOINT,
	endpointChaosSchema,
	endpointRuleSchema,
	endpointRulesSchema,
} from "./endpoint-behavior.js";
import {
	completeEndpoints,
	endpointInputSchema,
} from "./resource-templates.js";

const rule = (overrides: Record<string, unknown> = {}) => ({
	match: { source: "header", key: "X-Role" },
	op: "eq",
	value: "admin",
	response: { status: 403, body: { error: "forbidden" } },
	...overrides,
});

describe("endpoint chaos", () => {
	it("fills defaults and bounds every field", () => {
		expect(endpointChaosSchema.parse({})).toEqual({
			latencyMs: [0, 0],
			errorRate: 0,
			errorStatus: 500,
			timeoutRate: 0,
			rateLimitRate: 0,
		});
		const ok = { latencyMs: [100, MAX_CHAOS_DELAY_MS], errorRate: 0.5 };
		expect(endpointChaosSchema.safeParse(ok).success).toBe(true);
		for (const bad of [
			{ latencyMs: [0, MAX_CHAOS_DELAY_MS + 1] },
			{ latencyMs: [500, 100] },
			{ latencyMs: [-1, 10] },
			{ errorRate: 1.1 },
			{ errorRate: -0.1 },
			{ errorStatus: 302 },
			{ errorStatus: 600 },
			{ errorRate: 0.6, timeoutRate: 0.3, rateLimitRate: 0.2 },
		]) {
			expect(
				endpointChaosSchema.safeParse(bad).success,
				JSON.stringify(bad),
			).toBe(false);
		}
	});
});

describe("conditional rules", () => {
	it("lowercases header names and defaults response headers", () => {
		const parsed = endpointRuleSchema.parse(rule());
		expect(parsed.match).toEqual({ source: "header", key: "x-role" });
		expect(parsed.response.headers).toEqual([]);
	});

	it.each([
		["nth without a whole number", { match: { source: "nth" }, value: 1.5 }],
		[
			"nth with contains",
			{ match: { source: "nth" }, op: "contains", value: 2 },
		],
		["exists with a value", { op: "exists", value: "x" }],
		["eq without a value", { value: undefined }],
		["gt with a string", { op: "gt", value: "3" }],
		["an unsafe regex", { op: "regex", value: "(a+)+$" }],
		["a long regex", { op: "regex", value: "a".repeat(201) }],
		["a bad JSONPath", { match: { source: "body", path: "$..x" } }],
		["a forbidden query key", { match: { source: "query", key: "__proto__" } }],
		["an unknown source", { match: { source: "cookie", key: "a" } }],
		["an unknown op", { op: "like" }],
		["status 1xx", { response: { status: 101 } }],
		[
			"set-cookie",
			{
				response: {
					status: 200,
					headers: [{ name: "Set-Cookie", value: "a" }],
				},
			},
		],
		[
			"a CORS header",
			{
				response: {
					status: 200,
					headers: [{ name: "Access-Control-Allow-Origin", value: "x" }],
				},
			},
		],
		[
			"a hop-by-hop header",
			{
				response: {
					status: 200,
					headers: [{ name: "Connection", value: "x" }],
				},
			},
		],
		[
			"content-type",
			{
				response: {
					status: 200,
					headers: [{ name: "Content-Type", value: "text/html" }],
				},
			},
		],
		[
			"CRLF in a value",
			{
				response: {
					status: 200,
					headers: [{ name: "x-a", value: "a\r\nb: c" }],
				},
			},
		],
		[
			"a bad header name",
			{ response: { status: 200, headers: [{ name: "x a", value: "1" }] } },
		],
		[
			"duplicate headers",
			{
				response: {
					status: 200,
					headers: [
						{ name: "X-A", value: "1" },
						{ name: "x-a", value: "2" },
					],
				},
			},
		],
		[
			"an unknown template variable",
			{ response: { status: 200, body: "$nope" } },
		],
	])("refuses %s", (_name, overrides) => {
		expect(endpointRuleSchema.safeParse(rule(overrides)).success).toBe(false);
	});

	it("accepts every op on a valid shape", () => {
		const shapes = [
			{ op: "neq" },
			{ op: "contains", value: 3 },
			{ op: "regex", value: "^adm" },
			{ op: "exists", value: undefined },
			{ op: "gt", value: 2 },
			{ match: { source: "nth" }, op: "lt", value: 3 },
			{ match: { source: "query", key: "page" } },
			{ match: { source: "body", path: "$.user['a.b'][0]" } },
			{
				response: {
					status: 201,
					body: { data: "$mockData", n: "$count" },
					headers: [{ name: "X-Mock", value: "yes" }],
				},
			},
		];
		for (const shape of shapes) {
			const result = endpointRuleSchema.safeParse(rule(shape));
			expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
		}
	});

	it("caps the rules of an endpoint", () => {
		const full = Array.from({ length: MAX_RULES_PER_ENDPOINT }, () => rule());
		expect(endpointRulesSchema.safeParse(full).success).toBe(true);
		expect(endpointRulesSchema.safeParse([...full, rule()]).success).toBe(
			false,
		);
		const bulky = rule({ response: { status: 200, body: "x".repeat(4000) } });
		const heavy = Array.from({ length: MAX_RULES_PER_ENDPOINT }, () => bulky);
		expect(endpointRulesSchema.safeParse(heavy).success).toBe(false);
	});
});

describe("endpoint input", () => {
	it("keeps chaos and rules, and endpoints without them stay as before", () => {
		const input = endpointInputSchema.parse({
			method: "GET",
			path: "/:res",
			chaos: { errorRate: 0.5 },
			rules: [rule()],
		});
		const [list, one] = completeEndpoints([input]);
		expect(list?.chaos?.errorRate).toBe(0.5);
		expect(list?.rules).toHaveLength(1);
		expect(one).toEqual({
			method: "GET",
			path: "/:res/:id",
			enabled: true,
			response: "$mockData",
		});
	});
});
