import { describe, expect, it } from "vitest";
import {
	JsonTemplateError,
	renderJsonTemplate,
} from "./json-template-render.js";
import {
	RESPONSE_VARIABLES,
	type TemplateRules,
	checkTemplate,
	parseTemplateReference,
} from "./json-template.js";
import type { JsonValue } from "./json-value.js";

const METHODS = new Map<string, JsonValue>([
	["name.fullName", "Ada Lovelace"],
	["datatype.number", 7],
]);
const calls: string[] = [];
const resolveMethod = (id: string): JsonValue | undefined => {
	calls.push(id);
	return METHODS.get(id);
};
const variables = new Map<string, JsonValue>([
	["mockData", [{ id: "1" }, { id: "2" }]],
	["count", 2],
]);
const rules = {
	variables: RESPONSE_VARIABLES,
	isMethod: (id: string) => METHODS.has(id),
};

function problemsOf(template: unknown, templateRules: TemplateRules) {
	const result = checkTemplate(template, templateRules);
	return result.ok ? [] : result.problems;
}

function nested(depth: number): JsonValue {
	let value: JsonValue = "$count";
	for (let i = 0; i < depth; i += 1) value = { next: value };
	return value;
}

describe("parseTemplateReference", () => {
	it("recognizes whole-string variables and methods only", () => {
		expect(parseTemplateReference("$count")).toEqual({
			kind: "variable",
			name: "count",
		});
		expect(parseTemplateReference("$name.fullName")).toEqual({
			kind: "method",
			id: "name.fullName",
		});
		for (const literal of ["Hi $count", "$count!", "$5.99", "$", "count"]) {
			expect(parseTemplateReference(literal), literal).toBeNull();
		}
	});
});

describe("renderJsonTemplate", () => {
	it("replaces $mockData, $count and Faker methods anywhere in the tree", () => {
		const out = renderJsonTemplate(
			{
				data: "$mockData",
				meta: { total: "$count", by: ["$name.fullName", "$datatype.number"] },
				note: "costs $5 for $count items",
			},
			{ variables, resolveMethod },
		);
		expect(out).toEqual({
			data: [{ id: "1" }, { id: "2" }],
			meta: { total: 2, by: ["Ada Lovelace", 7] },
			note: "costs $5 for $count items",
		});
	});

	it("never runs unknown references and keeps them literal", () => {
		calls.length = 0;
		const template = [
			"$constructor",
			"$__proto__",
			"$toString",
			"$constructor.constructor",
			"$helpers.fake",
			"$hasOwnProperty",
		];
		const out = renderJsonTemplate(template, { variables, resolveMethod });
		expect(out).toEqual(template);
		expect(calls).toEqual(["constructor.constructor", "helpers.fake"]);
	});

	it("keeps a __proto__ key as data without touching any prototype", () => {
		const template = JSON.parse(
			'{"__proto__": {"polluted": "$count"}, "a": {"__proto__": 1}}',
		) as JsonValue;
		const out = renderJsonTemplate(template, { variables, resolveMethod });
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
		expect(Object.keys(out ?? {})).toEqual(["__proto__", "a"]);
		expect(JSON.stringify(out)).toBe(
			'{"__proto__":{"polluted":2},"a":{"__proto__":1}}',
		);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it("does not modify the template", () => {
		const template = { data: "$mockData" };
		renderJsonTemplate(template, { variables, resolveMethod });
		expect(template).toEqual({ data: "$mockData" });
	});

	it("renders deep templates within the limit and refuses deeper ones", () => {
		expect(
			renderJsonTemplate(nested(20), { variables, resolveMethod }),
		).toEqual(JSON.parse(JSON.stringify(nested(20)).replace('"$count"', "2")));
		expect(() =>
			renderJsonTemplate(nested(21), { variables, resolveMethod }),
		).toThrow(JsonTemplateError);
	});

	it("caps the output size, counting variables at full size", () => {
		const big = new Map<string, JsonValue>([
			["mockData", Array.from({ length: 100 }, (_, i) => i)],
		]);
		const template = Array.from({ length: 10 }, () => "$mockData");
		expect(() =>
			renderJsonTemplate(template, {
				variables: big,
				resolveMethod,
				maxRenderedNodes: 500,
			}),
		).toThrow(/exceeds 500 values/);
	});
});

describe("checkTemplate", () => {
	it("accepts allowed variables and whitelisted methods", () => {
		expect(
			problemsOf({ data: "$mockData", n: "$name.fullName" }, rules),
		).toEqual([]);
	});

	it("rejects unknown variables and methods with their path", () => {
		expect(
			problemsOf(
				{ a: ["$mockdata"], b: { c: "$constructor.constructor" } },
				rules,
			),
		).toEqual([
			{ path: "a.0", message: 'Unknown template variable "$mockdata"' },
			{
				path: "b.c",
				message: 'Unknown Faker method "$constructor.constructor"',
			},
		]);
		expect(
			problemsOf("$count", { variables: [], isMethod: () => false }),
		).toHaveLength(1);
	});

	it("rejects non-JSON values, __proto__ keys and oversized templates", () => {
		expect(problemsOf({ f: () => 1 }, rules)[0]?.message).toBe(
			"Value is not JSON",
		);
		expect(problemsOf({ n: Number.NaN }, rules)).toHaveLength(1);
		expect(
			problemsOf(JSON.parse('{"__proto__": {}}'), rules)[0]?.message,
		).toMatch(/__proto__/);
		expect(problemsOf(nested(21), rules)[0]?.message).toMatch(/deeper/);
		expect(
			problemsOf(
				Array.from({ length: 10 }, () => 1),
				{
					...rules,
					limits: { maxDepth: 5, maxNodes: 5 },
				},
			)[0]?.message,
		).toMatch(/more than 5 values/);
	});
});
