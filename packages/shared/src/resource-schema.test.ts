import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
	DEFAULT_RESOURCE_FIELDS,
	MAX_SCHEMA_FIELDS,
	parentKeyOf,
	resourceFieldsSchema,
	resourceNameSchema,
} from "./resource-schema.js";

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

	it("refuses mcp, the path of the project's MCP endpoint", () => {
		const result = resourceNameSchema.safeParse("mcp");
		expect(messages(result)).toEqual([
			expect.stringContaining("reserved for the project's MCP endpoint"),
		]);
		// Routes compare case-sensitively, so other spellings stay free.
		expect(resourceNameSchema.safeParse("MCP").success).toBe(true);
		expect(resourceNameSchema.safeParse("mcp-tools").success).toBe(true);
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

	it("allows one relation field per source", () => {
		const childId = "a".repeat(24);
		const otherChild = "b".repeat(24);
		const result = resourceFieldsSchema.safeParse([
			{ name: "posts", type: "Child Resource", childId },
			{ name: "comments", type: "Child Resource", childId: otherChild },
			{ name: "user", type: "Parent Resource" },
			{ name: "posts2", type: "Child Resource", childId },
			{ name: "owner", type: "Parent Resource" },
		]);
		expect(result.success).toBe(false);
		expect(
			result.success
				? []
				: result.error.issues.map(({ path, message }) => ({ path, message })),
		).toEqual([
			{
				path: [3, "childId"],
				message: 'Field "posts2" lists the same resource as "posts"',
			},
			{
				path: [4, "type"],
				message: 'Field "owner" embeds the same resource as "user"',
			},
		]);
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
