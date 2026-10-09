import { describe, expect, it } from "vitest";
import { resourcesOf } from "./schema-inference-test-utils.js";
import { inferSchema } from "./schema-inference.js";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const listOf = (name: string) => ({ type: "array", items: ref(name) });
const doc = (schemas: Record<string, unknown>) => ({
	openapi: "3.0.3",
	info: { title: "t", version: "1" },
	paths: {},
	components: { schemas },
});

const PETSTORE = doc({
	Owner: {
		type: "object",
		properties: {
			id: { type: "integer" },
			email: { type: "string", format: "email" },
			pets: listOf("Pet"),
		},
	},
	Pet: {
		type: "object",
		properties: {
			id: { type: "integer", format: "int64" },
			name: { type: "string" },
			OwnerId: { type: "integer" },
			category: ref("Category"),
			photoUrls: { type: "array", items: { type: "string" } },
			tags: listOf("Tag"),
			status: { type: "string", enum: ["available", "sold"] },
		},
	},
	Category: {
		type: "object",
		properties: { name: { type: "string" }, children: listOf("Category") },
	},
	Tag: { type: "object", properties: { label: { type: "string" } } },
	Shelter: { type: "object", properties: { pets: listOf("Pet") } },
	Status: { type: "string", enum: ["a", "b"] },
});

describe("inferSchema from OpenAPI", () => {
	it("maps components to a resource tree through array $ref", () => {
		const result = inferSchema(JSON.stringify(PETSTORE));
		const resources = resourcesOf(result);
		expect(resources.map((r) => [r.name, r.parentName, r.parentField])).toEqual(
			[
				["Owner", null, undefined],
				["Pet", "Owner", "pets"],
				["Tag", "Pet", "tags"],
				["Category", null, undefined],
				["Shelter", null, undefined],
			],
		);
		const [owner, pet, , category, shelter] = resources;
		expect(owner?.fields).toEqual([
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
		]);
		expect(pet?.fields.map((f) => [f.name, f.type])).toEqual([
			["name", pet?.fields[0]?.type],
			["category", "Object"],
			["photoUrls", "Array"],
			["status", "String"],
		]);
		expect(category?.fields.map((f) => f.name)).toEqual(["name", "children"]);
		expect(shelter?.fields).toEqual([{ name: "pets", type: "Array" }]);
		expect(resources.every((r) => r.records === undefined)).toBe(true);
		const messages = result.ok ? result.warnings : [];
		expect(messages).toEqual(
			expect.arrayContaining([
				{
					path: "Category.children",
					code: "KEPT_AS_ARRAY",
					params: { path: "Category.children" },
					message: "Refers to its own schema; kept as an Array field",
				},
				{
					path: "Shelter.pets",
					code: "KEPT_AS_ARRAY",
					params: { path: "Shelter.pets" },
					message:
						'"Pet" is already nested under "Owner"; kept as an Array field',
				},
				{
					path: "Pet.OwnerId",
					code: "SKIPPED",
					params: { path: "Pet.OwnerId" },
					message: "Generated for the parent link; removed",
				},
				{
					path: "Status",
					code: "SKIPPED",
					params: { path: "Status" },
					message: "Status is not an object schema; not imported",
				},
			]),
		);
	});

	it("refuses loops between components and keeps the depth cap", () => {
		const loop = resourcesOf(
			inferSchema(
				doc({
					A: { properties: { bs: listOf("B") } },
					B: { properties: { as: listOf("A"), x: { type: "string" } } },
				}),
				{ format: "openapi" },
			),
		);
		expect(loop.map((r) => [r.name, r.parentName])).toEqual([
			["A", null],
			["B", "A"],
		]);
		const chain = Object.fromEntries(
			Array.from({ length: 12 }, (_, i) => [
				`S${i}`,
				{
					properties: {
						v: { type: "number" },
						...(i < 11 ? { next: listOf(`S${i + 1}`) } : {}),
					},
				},
			]),
		);
		const deep = resourcesOf(inferSchema(doc(chain)));
		expect(deep.filter((r) => r.parentName !== null)).toHaveLength(10);
		expect(deep.find((r) => r.name === "S10")?.parentName).toBeNull();
	});

	it("reports $ref cycles, external $ref and other refusals clearly", () => {
		const cases: [unknown, string][] = [
			[doc({ A: ref("B"), B: ref("A") }), "REF_CYCLE"],
			[
				doc({ A: { allOf: [ref("B")] }, B: { allOf: [ref("A")] } }),
				"REF_CYCLE",
			],
			[
				doc({
					A: { properties: { x: { $ref: "https://evil.example/s.json" } } },
				}),
				"EXTERNAL_REF",
			],
			[doc({ A: { allOf: [{ $ref: "other.yaml#/A" }] } }), "EXTERNAL_REF"],
			[{ swagger: "2.0", paths: {} }, "UNSUPPORTED"],
			[
				{ openapi: "3.0.0", components: { schemas: { __proto__: {} } } },
				"INVALID_INPUT",
			],
			[
				'{"openapi":"3.0.0","components":{"schemas":{"__proto__":{"type":"object"}}}}',
				"INVALID_INPUT",
			],
		];
		for (const [input, code] of cases) {
			const result = inferSchema(input);
			expect(result.ok ? "ok" : result.error.code, JSON.stringify(input)).toBe(
				code,
			);
		}
		const cycle = inferSchema(doc({ A: ref("B"), B: ref("A") }));
		expect(!cycle.ok && cycle.error.message).toMatch(
			/\$ref cycle|includes itself/,
		);
		expect(!cycle.ok && cycle.error.params.cycle).toMatch(
			/^[AB] → [AB] → [AB]$/,
		);
	});

	it("imports a bare schema or a paths-only document as one resource", () => {
		const items = {
			type: "array",
			items: { properties: { n: { type: "number" } } },
		};
		const body = { content: { "application/json": { schema: items } } };
		const paths = { "/orders": { get: { responses: { "200": body } } } };
		const [bare] = resourcesOf(inferSchema({ openapi: "3.1.0", paths }));
		expect(bare).toEqual({
			name: "orders",
			parentName: null,
			fields: [{ name: "n", type: "Number" }],
		});
		const [schema] = resourcesOf(
			inferSchema(
				{
					title: "Event",
					type: "object",
					properties: { at: { type: "string", format: "date" } },
				},
				{ format: "openapi" },
			),
		);
		expect(schema).toMatchObject({
			name: "Event",
			fields: [{ name: "at", type: "Date" }],
		});
	});
});
