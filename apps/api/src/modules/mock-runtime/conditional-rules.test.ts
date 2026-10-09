import {
	type EndpointRule,
	MAX_REGEX_INPUT,
	RULE_OPS,
	endpointRuleSchema,
} from "@localman/shared/endpoint-behavior";
import { describe, expect, it } from "vitest";
import {
	RequestCounter,
	type RuleRequest,
	compileRulePattern,
	firstMatchingRule,
	ruleMatches,
} from "./conditional-rules.js";

const request: RuleRequest = {
	headers: { "x-role": "admin", authorization: "Bearer abc.def" },
	query: { page: "3", tag: ["a", "b"], q: "" },
	body: { user: { role: "editor", age: 31, tags: ["x", "y"] }, "a.b": true },
	nth: 4,
};

function rule(match: unknown, op: string, value?: unknown): EndpointRule {
	return endpointRuleSchema.parse({
		match,
		op,
		value,
		response: { status: 200 },
	});
}

const header = (key: string) => ({ source: "header", key });
const query = (key: string) => ({ source: "query", key });
const body = (path: string) => ({ source: "body", path });
const nth = { source: "nth" };

describe("rule ops on every source", () => {
	it.each([
		[header("X-Role"), "eq", "admin", true],
		[header("x-role"), "eq", "Admin", false],
		[header("x-role"), "neq", "viewer", true],
		[header("x-missing"), "neq", "admin", true],
		[header("x-missing"), "eq", "admin", false],
		[header("authorization"), "contains", "Bearer", true],
		[header("authorization"), "regex", "^Bearer [a-z.]+$", true],
		[header("authorization"), "regex", "^Basic ", false],
		[header("x-role"), "exists", undefined, true],
		[header("x-other"), "exists", undefined, false],
		[query("page"), "eq", 3, true],
		[query("page"), "eq", "3", true],
		[query("page"), "gt", 2, true],
		[query("page"), "lt", 3, false],
		[query("q"), "exists", undefined, true],
		[query("q"), "gt", 0, false],
		[query("tag"), "contains", "b", true],
		[query("tag"), "eq", "a", false],
		[query("toString"), "exists", undefined, false],
		[body("$.user.role"), "eq", "editor", true],
		[body("$.user.age"), "gt", 30, true],
		[body("$.user.age"), "lt", 30, false],
		[body("$.user.age"), "eq", "31", true],
		[body("$.user.tags[1]"), "eq", "y", true],
		[body("$.user.tags"), "contains", "x", true],
		[body("$['a.b']"), "eq", "true", true],
		[body("$.user.missing"), "exists", undefined, false],
		[body("$.user"), "eq", "[object Object]", false],
		[body("$.user.role"), "regex", "^ed", true],
		[nth, "eq", 4, true],
		[nth, "neq", 4, false],
		[nth, "gt", 3, true],
		[nth, "lt", 4, false],
	])("%j %s %j is %s", (match, op, value, expected) => {
		expect(ruleMatches(rule(match, op, value), request)).toBe(expected);
	});

	it.each(RULE_OPS)("never matches a header rule with %s over MCP", (op) => {
		const value =
			op === "exists" ? undefined : op === "gt" || op === "lt" ? 1 : "admin";
		const viaMcp = { ...request, headers: null };
		expect(ruleMatches(rule(header("x-role"), op, value), viaMcp)).toBe(false);
	});

	it("never matches headers over MCP", () => {
		const viaMcp = { ...request, headers: null };
		expect(ruleMatches(rule(header("x-role"), "exists"), viaMcp)).toBe(false);
		expect(ruleMatches(rule(header("x-role"), "eq", "admin"), viaMcp)).toBe(
			false,
		);
	});
});

describe("rule order", () => {
	const admin = rule(header("x-role"), "eq", "admin");
	const third = rule(nth, "gt", 2);
	const never = rule(header("x-role"), "eq", "nobody");

	it("answers with the first rule that matches and stops", () => {
		expect(firstMatchingRule([never, admin, third], request)).toBe(admin);
		expect(firstMatchingRule([third, admin], request)).toBe(third);
		expect(firstMatchingRule([never], request)).toBeNull();
		expect(firstMatchingRule(undefined, request)).toBeNull();
		expect(firstMatchingRule([], request)).toBeNull();
	});
});

describe("regex at runtime", () => {
	it("refuses unsafe patterns even when stored", () => {
		expect(compileRulePattern("(a+)+$")).toBeNull();
		expect(compileRulePattern("^ok$")?.test("ok")).toBe(true);
		const stored: EndpointRule = {
			...rule(header("x-role"), "regex", "^a"),
			value: "(a|aa)*$",
		};
		const hostile = { ...request, headers: { "x-role": "a".repeat(40) } };
		const started = performance.now();
		expect(ruleMatches(stored, hostile)).toBe(false);
		expect(performance.now() - started).toBeLessThan(50);
	});

	it("does not test text longer than MAX_REGEX_INPUT", () => {
		const long = {
			...request,
			headers: { "x-a": "a".repeat(MAX_REGEX_INPUT + 1) },
		};
		expect(ruleMatches(rule(header("x-a"), "regex", "^a"), long)).toBe(false);
		const fits = {
			...request,
			headers: { "x-a": "a".repeat(MAX_REGEX_INPUT) },
		};
		expect(ruleMatches(rule(header("x-a"), "regex", "^a"), fits)).toBe(true);
	});
});

describe("request counter", () => {
	it("counts per key from 1, resets and forgets the oldest keys", () => {
		const counter = new RequestCounter(2);
		expect([
			counter.next("p", "a"),
			counter.next("p", "a"),
			counter.next("p", "b"),
		]).toEqual([1, 2, 1]);
		counter.reset("p");
		expect(counter.next("p", "a")).toBe(1);
		counter.next("p", "b");
		// "a" is now the least recently used of three keys.
		counter.next("q", "c");
		expect(counter.next("p", "a")).toBe(1);
		counter.reset();
		expect(counter.next("q", "c")).toBe(1);
	});

	it("caps the keys of one project without touching the others", () => {
		const counter = new RequestCounter(100, 3);
		counter.next("quiet", "list");
		counter.next("quiet", "list");
		for (let i = 0; i < 50; i += 1) counter.next("noisy", `key-${i}`);
		expect(counter.next("quiet", "list")).toBe(3);
		expect(counter.next("noisy", "key-49")).toBe(2);
		expect(counter.next("noisy", "key-0")).toBe(1);
	});
});
