import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	DEFAULT_RESOURCE_FIELDS,
	MAX_SCHEMA_FIELDS,
	parentKeyOf,
	resourceCreateSchema,
	resourceFieldsSchema,
	resourceNameSchema,
} from "./resource-schema.js";
import { completeEndpoints } from "./resource-templates.js";

const messages = (result: z.ZodSafeParseResult<unknown>): string[] =>
	result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("resource name", () => {
	it("accepts path-safe names and rejects anything else", () => {
		for (const name of ["users", "user_profiles", "v2-items", "9lives"]) {
			expect(resourceNameSchema.safeParse(name).success, name).toBe(true);
		}
		for (const name of ["", "../x", "a/b", "a b", "-x", "a.b", "x?y", "é"]) {
			expect(resourceNameSchema.safeParse(name).success, name).toBe(false);
		}
		expect(resourceNameSchema.safeParse("x".repeat(65)).success).toBe(false);
	});
});

describe("schema fields", () => {
	it("accepts the default schema", () => {
		expect(resourceFieldsSchema.parse(DEFAULT_RESOURCE_FIELDS)).toEqual(
			DEFAULT_RESOURCE_FIELDS,
		);
	});

	it("requires a whitelisted method for Faker.js fields only", () => {
		const parse = (field: object) =>
			messages(resourceFieldsSchema.safeParse([field]));
		expect(parse({ name: "a", type: "Faker.js" })).toEqual([
			"Faker.js fields need a Faker method",
		]);
		expect(
			parse({ name: "a", type: "Faker.js", fakerMethod: "helpers.fake" }),
		).toEqual(['Unknown Faker method "helpers.fake"']);
		expect(
			parse({ name: "a", type: "String", fakerMethod: "name.fullName" }),
		).toEqual(["Only Faker.js fields have a Faker method"]);
		expect(parse({ name: "kids", type: "Child Resource" })).toEqual([
			"Child Resource fields need a child resource",
		]);
		expect(parse({ name: "a.b-c_d", type: "Number" })).toEqual([]);
		expect(parse({ name: "a b", type: "Number" })).toHaveLength(1);
		for (const name of ["__proto__", "constructor", "prototype"]) {
			expect(parse({ name, type: "String" }), name).toEqual([
				"Field names cannot be __proto__, constructor, prototype",
			]);
		}
		expect(parse({ name: "a", type: "Function" })).toHaveLength(1);
	});

	it("keeps id for the system and refuses duplicates and oversized schemas", () => {
		expect(
			messages(
				resourceFieldsSchema.safeParse([{ name: "id", type: "String" }]),
			),
		).toEqual(['"id" is generated and cannot be a schema field']);
		expect(
			messages(
				resourceFieldsSchema.safeParse([
					{ name: "a", type: "String" },
					{ name: "a", type: "Number" },
				]),
			),
		).toEqual(['Field "a" appears more than once']);
		const many = Array.from({ length: MAX_SCHEMA_FIELDS + 1 }, (_, i) => ({
			name: `f${i}`,
			type: "String",
		}));
		expect(resourceFieldsSchema.safeParse(many).success).toBe(false);
	});
});

describe("templates and endpoints", () => {
	it("allows Faker refs in the object template but not response variables", () => {
		const ok = resourceCreateSchema.parse({
			name: "users",
			template: { profile: { name: "$name.fullName" }, tags: ["$word.noun"] },
		});
		expect(ok.template).toEqual({
			profile: { name: "$name.fullName" },
			tags: ["$word.noun"],
		});
		expect(
			messages(
				resourceCreateSchema.safeParse({
					name: "users",
					template: { all: "$mockData", x: "$constructor.constructor" },
				}),
			),
		).toEqual([
			'all: Unknown template variable "$mockData"',
			'x: Unknown Faker method "$constructor.constructor"',
		]);
		expect(
			resourceCreateSchema.safeParse({ name: "users", template: [1] }).success,
		).toBe(false);
		expect(resourceCreateSchema.parse({ name: "u" }).template).toBeUndefined();
		expect(
			resourceCreateSchema.parse({ name: "u", template: null }).template,
		).toBeNull();
	});

	it("validates custom responses and only the five known endpoints", () => {
		const parsed = resourceCreateSchema.parse({
			name: "users",
			endpoints: [
				{
					method: "GET",
					path: "/:res",
					response: { data: "$mockData", total: "$count" },
				},
				{ method: "DELETE", path: "/:res/:id", enabled: false },
				{ method: "POST", path: "/:res", response: null },
			],
		});
		const endpoints = completeEndpoints(parsed.endpoints);
		expect(endpoints).toHaveLength(5);
		expect(endpoints[0]).toEqual({
			method: "GET",
			path: "/:res",
			enabled: true,
			response: { data: "$mockData", total: "$count" },
		});
		expect(endpoints[2]?.response).toBeNull();
		expect(endpoints[4]).toMatchObject({
			enabled: false,
			response: "$mockData",
		});
		for (const endpoints of [
			[{ method: "POST", path: "/:res/:id" }],
			[
				{ method: "GET", path: "/:res" },
				{ method: "GET", path: "/:res" },
			],
			[{ method: "GET", path: "/:res", response: "$mockdata" }],
		]) {
			expect(
				resourceCreateSchema.safeParse({ name: "u", endpoints }).success,
			).toBe(false);
		}
	});

	it("converts to JSON Schema for MCP and OpenAPI", () => {
		expect(() =>
			z.toJSONSchema(resourceCreateSchema, { io: "input" }),
		).not.toThrow();
	});
});

describe("parentKeyOf", () => {
	it("singularizes the parent name like the source", () => {
		expect(parentKeyOf("users")).toBe("userId");
		expect(parentKeyOf("categories")).toBe("categoryId");
		expect(parentKeyOf("boxes")).toBe("boxId");
		expect(parentKeyOf("address")).toBe("addressId");
		expect(parentKeyOf("data")).toBe("dataId");
	});
});
