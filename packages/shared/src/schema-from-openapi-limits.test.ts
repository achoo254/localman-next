import { describe, expect, it } from "vitest";
import { MAX_OPENAPI_BYTES } from "./openapi-document.js";
import {
	type OpenApiImportResult,
	schemaFromOpenApi,
} from "./schema-from-openapi.js";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errorOf = (result: OpenApiImportResult): string =>
	result.ok ? "ok" : result.error.code;
const doc = (schemas: object) => ({
	openapi: "3.1.0",
	components: { schemas },
});
const PET = doc({ Pet: { properties: { name: { type: "string" } } } });
/**
 * Ceiling for walks that would take minutes without their guards (10^12
 * paths, 60 000 x 19 000 merges). It also covers parsing the input, so it
 * leaves room for a shared CI runner rather than timing the happy path.
 */
const FAST_MS = 1000;

describe("schemaFromOpenApi on unsafe input", () => {
	it("rejects cycles, external refs and bad references", () => {
		const cases: [object, string][] = [
			[doc({ A: ref("B"), B: ref("A") }), "REF_CYCLE"],
			[doc({ A: { allOf: [ref("A")] } }), "REF_CYCLE"],
			[
				doc({ A: { allOf: [ref("B")] }, B: { allOf: [ref("A")] } }),
				"REF_CYCLE",
			],
			[
				doc({
					A: { properties: { a: { $ref: "https://evil.example/x.json" } } },
				}),
				"EXTERNAL_REF",
			],
			[doc({ A: { allOf: [{ $ref: "other.yaml#/A" }] } }), "EXTERNAL_REF"],
			[doc({ A: { properties: { a: ref("Missing") } } }), "SCHEMA_NOT_FOUND"],
			[
				doc({
					A: {
						properties: { a: { $ref: "#/components/schemas/A/constructor" } },
					},
				}),
				"SCHEMA_NOT_FOUND",
			],
			[doc({ A: { properties: { a: { $ref: "#anchor" } } } }), "UNSUPPORTED"],
		];
		for (const [input, code] of cases) {
			expect(errorOf(schemaFromOpenApi(input)), JSON.stringify(input)).toBe(
				code,
			);
		}
	});

	it("bounds size, depth and work", () => {
		const big = JSON.stringify({
			openapi: "3.0.0",
			pad: "x".repeat(MAX_OPENAPI_BYTES),
		});
		expect(errorOf(schemaFromOpenApi(big))).toBe("INPUT_TOO_LARGE");
		const deep = `{"type":"object","properties":{"a":${'{"items":'.repeat(100)}{}${"}".repeat(100)}}}`;
		expect(errorOf(schemaFromOpenApi(deep))).toBe("INVALID_INPUT");
		const brackets = "[".repeat(1_000_000);
		expect(errorOf(schemaFromOpenApi(`{"a":${brackets}`))).toBe(
			"INVALID_INPUT",
		);
		const chain: Record<string, object> = {
			S0: { properties: { a: { type: "string" } } },
		};
		for (let i = 1; i <= 40; i += 1) chain[`S${i}`] = ref(`S${i - 1}`);
		expect(errorOf(schemaFromOpenApi(doc(chain), { schema: "S40" }))).toBe(
			"TOO_DEEP",
		);
	});

	it("walks a $ref shared by many allOf branches once", () => {
		// 10^12 paths without the memo of merged properties per $ref.
		const fanOut: Record<string, object> = {
			L0: { properties: { a: { type: "string" } } },
		};
		for (let i = 1; i <= 12; i += 1)
			fanOut[`L${i}`] = { allOf: Array(10).fill(ref(`L${i - 1}`)) };
		const started = performance.now();
		const result = schemaFromOpenApi(doc(fanOut), { schema: "L12" });
		expect(result.ok && result.fields).toEqual([{ name: "a", type: "String" }]);
		expect(performance.now() - started).toBeLessThan(FAST_MS);
	});

	it.each([
		[10_000, 1_000],
		[20_000, 2_000],
		[60_000, 19_000],
	])(
		"refuses %i properties merged through %i allOf refs quickly",
		(props, refs) => {
			const big: Record<string, object> = {};
			for (let i = 0; i < props; i += 1) big[`p${i}`] = {};
			const text = JSON.stringify(
				doc({
					A: { type: "object", allOf: Array(refs).fill(ref("B")) },
					B: { type: "object", properties: big },
				}),
			);
			const started = performance.now();
			expect(errorOf(schemaFromOpenApi(text, { schema: "A" }))).toBe(
				"TOO_COMPLEX",
			);
			expect(performance.now() - started).toBeLessThan(FAST_MS);
		},
	);

	it("refuses prototype keys, YAML and other formats safely", () => {
		const cases: [unknown, string][] = [
			[
				'{"openapi":"3.0.0","components":{"schemas":{"A":{"properties":{"__proto__":{"type":"string"}}}}}}',
				"INVALID_INPUT",
			],
			[
				doc({ A: { properties: { constructor: { type: "string" } } } }),
				"INVALID_INPUT",
			],
			["openapi: 3.0.0\ninfo:\n  title: x", "UNSUPPORTED"],
			["{ not json", "INVALID_INPUT"],
			['"just a string"', "UNSUPPORTED"],
			[[], "INVALID_INPUT"],
			[null, "INVALID_INPUT"],
			[{ swagger: "2.0", definitions: {} }, "UNSUPPORTED"],
			[{ openapi: "4.0.0", components: {} }, "UNSUPPORTED"],
			[{ openapi: "3.0.0", components: {} }, "SCHEMA_NOT_FOUND"],
			[doc({ A: { type: "string" } }), "UNSUPPORTED"],
			[doc({ A: { type: "object" } }), "NO_FIELDS"],
		];
		for (const [input, code] of cases) {
			expect(
				errorOf(schemaFromOpenApi(input)),
				String(input).slice(0, 60),
			).toBe(code);
		}
		expect(errorOf(schemaFromOpenApi(PET, { schema: "toString" }))).toBe(
			"SCHEMA_NOT_FOUND",
		);
		expect(errorOf(schemaFromOpenApi(PET, { path: "/nope" }))).toBe(
			"SCHEMA_NOT_FOUND",
		);
		const odd = doc({
			A: { properties: { toString: { type: "string", format: "__proto__" } } },
		});
		const result = schemaFromOpenApi(odd);
		expect(result.ok && result.fields).toEqual([
			{ name: "toString", type: "String" },
		]);
	});
});
