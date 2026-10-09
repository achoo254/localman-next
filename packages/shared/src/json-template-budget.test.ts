import { describe, expect, it } from "vitest";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { fakerMethodMaxBytes } from "./faker-method-sizes.js";
import { runFakerMethod } from "./faker-methods.js";
import {
	JsonTemplateError,
	renderJsonTemplate,
} from "./json-template-render.js";
import {
	MAX_METHOD_REFERENCES,
	RESPONSE_VARIABLES,
	checkTemplate,
	estimateTemplateBytes,
} from "./json-template.js";
import { type JsonValue, jsonSize } from "./json-value.js";
import { MAX_RECORD_BYTES } from "./plan-limits.js";

const variables = new Map<string, JsonValue>([["count", 2]]);
const resolveMethod = (): JsonValue | undefined => undefined;
const rules = { variables: RESPONSE_VARIABLES, isMethod: isFakerMethodId };
const problemsOf = (template: unknown) => {
	const result = checkTemplate(template, rules);
	return result.ok ? [] : result.problems;
};

describe("template size budgets", () => {
	const BOMB = Array.from({ length: 1999 }, () => "$lorem.paragraphs");

	it("refuses to store a template with too many Faker calls", () => {
		const result = checkTemplate(BOMB, {
			variables: [],
			isMethod: isFakerMethodId,
		});
		expect(result.ok).toBe(false);
		expect(result.ok ? [] : result.problems).toEqual([
			{
				path: "200",
				message: `A template may call at most ${MAX_METHOD_REFERENCES} Faker methods`,
			},
		]);
		const fits = BOMB.slice(0, MAX_METHOD_REFERENCES);
		expect(
			checkTemplate(fits, { variables: [], isMethod: isFakerMethodId }).ok,
		).toBe(true);
	});

	it("stops rendering as soon as the byte budget is passed", () => {
		let calls = 0;
		const rssBefore = process.memoryUsage().rss;
		const started = performance.now();
		let error: unknown;
		try {
			renderJsonTemplate(BOMB, {
				resolveMethod: (id) => {
					calls += 1;
					return runFakerMethod(id);
				},
				maxBytes: MAX_RECORD_BYTES,
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(JsonTemplateError);
		expect(error instanceof JsonTemplateError && error.bytes).toBeGreaterThan(
			MAX_RECORD_BYTES,
		);
		// Each paragraph is a few hundred bytes: far fewer than 1999 calls.
		expect(calls).toBeLessThan(200);
		expect(performance.now() - started).toBeLessThan(500);
		expect(process.memoryUsage().rss - rssBefore).toBeLessThan(
			32 * 1024 * 1024,
		);
	});

	it("counts bytes like JSON.stringify for plain ASCII output", () => {
		const out = renderJsonTemplate(
			{ a: [1, "x", true, null], b: { c: "$count" } },
			{ variables, resolveMethod, maxBytes: 1_000 },
		);
		expect(jsonSize(out).bytes).toBe(JSON.stringify(out).length);
		expect(() =>
			renderJsonTemplate(
				{ a: "x".repeat(100) },
				{ resolveMethod, maxBytes: 50 },
			),
		).toThrow(/exceeds 50 bytes/);
	});

	it("refuses constructor and prototype keys like __proto__", () => {
		for (const key of ["constructor", "prototype"]) {
			expect(problemsOf({ [key]: 1 })[0]?.message, key).toBe(
				`Key "${key}" is not allowed`,
			);
		}
	});
	it("estimates an upper bound of every render before storing", () => {
		const literal = { a: [1, "x", true, null], b: { c: "é" } };
		expect(estimateTemplateBytes(literal, fakerMethodMaxBytes)).toBe(
			Buffer.byteLength(JSON.stringify(literal)),
		);
		const template = {
			bio: "$lorem.paragraphs",
			tags: ["$word.noun", "$lorem.sentence", "fixed"],
			token: "$internet.jwt",
		};
		const bound = estimateTemplateBytes(template, fakerMethodMaxBytes);
		for (let i = 0; i < 200; i += 1) {
			const out = renderJsonTemplate(template, {
				resolveMethod: (id) => runFakerMethod(id),
			});
			expect(Buffer.byteLength(JSON.stringify(out))).toBeLessThanOrEqual(bound);
		}
	});
});
