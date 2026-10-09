import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ruleSummary } from "./behavior-summary";
import { type RuleDraft, ruleDraft } from "./endpoint-behavior-draft";
import { checkBehavior } from "./endpoint-behavior-validation";
import {
	type EndpointDraft,
	type RulePart,
	draftOf,
} from "./resource-form-state";

const { t } = createTranslator("en", en);

function endpoint(patch: Partial<EndpointDraft> = {}): EndpointDraft {
	const [first] = draftOf(null).endpoints;
	if (!first) throw new Error("no endpoint");
	return { ...first, ...patch };
}

function rule(patch: Partial<RuleDraft>): RuleDraft {
	return { ...ruleDraft(), target: "x-role", value: "admin", ...patch };
}

/** Error of the only rule's `part`, or undefined. */
function ruleError(draft: RuleDraft, part: RulePart): string | undefined {
	const { errors } = checkBehavior(endpoint({ rules: [draft] }), t);
	return errors?.rules[draft.key]?.[part];
}

describe("endpoint rules", () => {
	it("builds the API rule for each kind of match", () => {
		const rules = [
			rule({ headers: '{ "X-Reason": "forbidden" }', status: "403" }),
			rule({ source: "query", target: "page", op: "gt", value: "3" }),
			rule({ source: "body", target: "$.user.role", op: "exists", value: "" }),
			rule({
				source: "nth",
				target: "",
				op: "eq",
				value: "2",
				body: '{"a":1}',
			}),
		];
		expect(checkBehavior(endpoint({ rules }), t).rules).toEqual([
			{
				match: { source: "header", key: "x-role" },
				op: "eq",
				value: "admin",
				response: {
					status: 403,
					headers: [{ name: "x-reason", value: "forbidden" }],
				},
			},
			{
				match: { source: "query", key: "page" },
				op: "gt",
				value: 3,
				response: { status: 200, headers: [] },
			},
			{
				match: { source: "body", path: "$.user.role" },
				op: "exists",
				response: { status: 200, headers: [] },
			},
			{
				match: { source: "nth" },
				op: "eq",
				value: 2,
				response: { status: 200, headers: [], body: { a: 1 } },
			},
		]);
	});

	it("checks the value against the condition", () => {
		expect(ruleError(rule({ value: "" }), "value")).toBe("Enter a value.");
		expect(
			ruleError(rule({ op: "exists", value: "" }), "value"),
		).toBeUndefined();
		expect(ruleError(rule({ op: "gt", value: "ten" }), "value")).toBe(
			"Enter a number to compare with.",
		);
		expect(ruleError(rule({ source: "nth", value: "0" }), "value")).toBe(
			"Enter a whole number from 1.",
		);
		expect(ruleError(rule({ value: "x".repeat(1001) }), "value")).toBe(
			"Can be at most 1,000 characters.",
		);
		expect(ruleError(rule({ op: "regex", value: "(a" }), "value")).toMatch(
			/isn't valid/,
		);
		expect(ruleError(rule({ op: "regex", value: "(a+)+$" }), "value")).toMatch(
			/could make the mock slow/,
		);
		expect(
			ruleError(rule({ op: "regex", value: "^adm.*$" }), "value"),
		).toBeUndefined();
	});

	it("checks keys, JSONPath, status and headers", () => {
		expect(ruleError(rule({ target: " " }), "target")).toBe(
			"Enter a header name.",
		);
		expect(ruleError(rule({ source: "query", target: "" }), "target")).toBe(
			"Enter a parameter name.",
		);
		expect(
			ruleError(rule({ source: "body", target: "user.role" }), "target"),
		).toMatch(/starts with <code>\$<\/code>/);
		expect(ruleError(rule({ status: "150" }), "status")).toBe(
			"Enter a status code from 200 to 599.",
		);
		expect(ruleError(rule({ headers: "[1]" }), "headers")).toMatch(
			/JSON object/,
		);
		expect(
			ruleError(rule({ headers: '{"Set-Cookie":"a"}' }), "headers"),
		).toMatch(/^A rule can't set <code>set-cookie<\/code>/);
		for (const name of ["NEL", "Report-To", "Link", "X-Forwarded-Host"]) {
			const headers = JSON.stringify({ [name]: "x" });
			expect(ruleError(rule({ headers }), "headers"), name).toMatch(
				/A rule can't set/,
			);
		}
		const location = '{"Location":"/v2"}';
		expect(ruleError(rule({ headers: location }), "headers")).toMatch(
			/only works with a 3xx status/,
		);
		expect(
			ruleError(rule({ headers: location, status: "302" }), "headers"),
		).toBeUndefined();
		expect(
			ruleError(rule({ headers: '{"Content-Type":"text/html"}' }), "headers"),
		).toMatch(/must be a JSON type/);
		expect(
			ruleError(
				rule({ headers: '{"Content-Type":"application/problem+json"}' }),
				"headers",
			),
		).toBeUndefined();
		expect(
			ruleError(
				rule({ headers: '{"Access-Control-Allow-Origin":"*"}' }),
				"headers",
			),
		).toMatch(/access-control-allow-origin/);
		expect(ruleError(rule({ body: "{oops" }), "body")).toBe(
			"The response template isn't valid JSON.",
		);
	});

	it("keeps a saved number a number", () => {
		const saved = ruleDraft(savedRule(10));
		const text = ruleDraft(savedRule("10"));
		const [number, string] =
			checkBehavior(endpoint({ rules: [saved, text] }), t).rules ?? [];
		expect(number?.value).toBe(10);
		expect(string?.value).toBe("10");
		const edited = { ...saved, value: "ten" };
		const [changed] =
			checkBehavior(endpoint({ rules: [edited] }), t).rules ?? [];
		expect(changed?.value).toBe("ten");
	});

	it("summarises a rule in one line, or calls it incomplete", () => {
		expect(ruleSummary(rule({ status: "403" }), t)).toBe(
			'header x-role equals "admin" → 403',
		);
		expect(
			ruleSummary(
				rule({ source: "nth", op: "gt", value: "3", status: "429" }),
				t,
			),
		).toBe("request number is greater than 3 → 429");
		expect(ruleSummary(rule({ target: "" }), t)).toBeNull();
	});
});

function savedRule(value: string | number) {
	return {
		match: { source: "body" as const, path: "$.age" },
		op: "eq" as const,
		value,
		response: { status: 200, headers: [] },
	};
}
