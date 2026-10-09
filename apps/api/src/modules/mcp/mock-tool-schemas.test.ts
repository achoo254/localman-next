import { MAX_PAGE_LIMIT, MOCK_QUERY_PARAMS } from "@localman/shared";
import { describe, expect, it } from "vitest";
import type { ToolShape } from "./mock-tool-fields.js";
import {
	createInput,
	listInput,
	recordInput,
	updateInput,
} from "./mock-tool-schemas.js";

const ROOT: ToolShape = {
	schema: [
		{ name: "title", type: "String" },
		{ name: "views", type: "Number" },
		{ name: "draft", type: "Boolean" },
		{ name: "publishedAt", type: "Date" },
		{ name: "meta", type: "Object" },
		{ name: "tags", type: "Array" },
		{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
		{ name: "owner", type: "Parent Resource" },
		{ name: "limit", type: "Number" },
		{ name: "l", type: "Number" },
		{ name: "a.b", type: "String" },
	],
	template: null,
	parentKey: null,
	parentName: null,
};
const NESTED: ToolShape = {
	...ROOT,
	schema: [
		{ name: "body", type: "String" },
		{ name: "parentId", type: "String" },
	],
	parentKey: "postId",
	parentName: "posts",
};

describe("listInput", () => {
	it("uses the primary REST query names and caps limit", () => {
		const { properties, required } = listInput(ROOT);
		for (const names of Object.values(MOCK_QUERY_PARAMS)) {
			const [primary, ...aliases] = names;
			expect(properties).toHaveProperty(primary);
			for (const alias of aliases) expect(properties).not.toHaveProperty(alias);
		}
		expect(properties.limit).toEqual(
			expect.objectContaining({
				type: "integer",
				minimum: 1,
				maximum: MAX_PAGE_LIMIT,
			}),
		);
		expect(properties.page).toMatchObject({ type: "integer", minimum: 1 });
		expect(properties.order?.enum).toEqual(["asc", "desc"]);
		expect(required).toEqual([]);
		expect(properties).not.toHaveProperty("parentId");
	});

	it("filters on fields the REST list can match, typed by field", () => {
		const { properties } = listInput(ROOT);
		expect(properties.title?.type).toBe("string");
		expect(properties.publishedAt?.type).toBe("string");
		expect(properties.views?.type).toBe("number");
		expect(properties.draft?.type).toBe("boolean");
		expect(properties.email?.type).toEqual(["string", "number", "boolean"]);
		expect(properties.title?.description).toContain("substring");
		expect(properties.views?.description).toContain("(exact)");
		expect(properties.email?.description).toContain("text, exact otherwise");
		for (const skipped of ["meta", "tags", "owner", "l", "a.b", "id"]) {
			expect(properties).not.toHaveProperty(skipped);
		}
		// `limit` stays the page size, not a filter on the field.
		expect(properties.limit?.type).toBe("integer");
		expect(properties.sortBy?.enum).toEqual([
			"id",
			"title",
			"views",
			"draft",
			"publishedAt",
			"meta",
			"tags",
			"email",
			"limit",
			"l",
		]);
	});

	it("takes parentId on a nested resource, never as a filter", () => {
		const { properties } = listInput(NESTED);
		expect(properties.parentId?.type).toBe("string");
		expect(properties.parentId?.description).toContain('"posts"');
		expect(properties.body?.type).toBe("string");
		expect(properties.sortBy?.enum).toEqual([
			"id",
			"postId",
			"body",
			"parentId",
		]);
	});

	it("types template filters by the template literal", () => {
		const { properties } = listInput({
			...ROOT,
			template: { label: "x", n: 1, on: true, who: "$name.fullName", o: {} },
		});
		expect(properties.label?.type).toBe("string");
		expect(properties.n?.type).toBe("number");
		expect(properties.on?.type).toBe("boolean");
		expect(properties.who?.type).toEqual(["string", "number", "boolean"]);
		expect(properties).not.toHaveProperty("o");
		expect(properties).not.toHaveProperty("title");
	});
});

describe("record inputs", () => {
	it("types create and update data by the schema, without id", () => {
		const data = createInput(ROOT).properties.data;
		expect(data?.additionalProperties).toBe(false);
		expect(data?.properties).toEqual({
			title: { type: "string" },
			views: { type: "number" },
			draft: { type: "boolean" },
			publishedAt: { type: "string", format: "date-time" },
			meta: { type: "object" },
			tags: { type: "array" },
			email: expect.objectContaining({ description: expect.any(String) }),
			limit: { type: "number" },
			l: { type: "number" },
			"a.b": { type: "string" },
		});
		expect(data?.properties?.email).not.toHaveProperty("type");
		expect(createInput(ROOT).properties).not.toHaveProperty("id");
		expect(createInput(ROOT).required).toEqual([]);
		expect(updateInput(ROOT).required).toEqual(["id", "data"]);
		expect(updateInput(ROOT).properties.data).toEqual(
			expect.objectContaining({ properties: data?.properties }),
		);
	});

	it("requires parentId to create a nested record only", () => {
		expect(createInput(NESTED).required).toEqual(["parentId"]);
		expect(recordInput(NESTED).required).toEqual(["id"]);
		expect(recordInput(NESTED).properties).toHaveProperty("parentId");
		expect(updateInput(NESTED).properties.data?.properties).toEqual({
			body: { type: "string" },
			parentId: { type: "string" },
		});
	});

	it("leaves template data free but bounded, dropping system keys", () => {
		const data = createInput({
			...NESTED,
			template: { id: "x", postId: "1", label: "$lorem.word", n: 1 },
		}).properties.data;
		expect(data?.additionalProperties).toBe(true);
		expect(data?.properties).toEqual({ label: {}, n: {} });
		expect(data?.maxProperties).toBeGreaterThan(0);
	});

	it("closes every input object and declares JSON Schema 2020-12", () => {
		for (const build of [listInput, recordInput, createInput, updateInput]) {
			const schema = build(NESTED);
			expect(schema.$schema).toBe(
				"https://json-schema.org/draft/2020-12/schema",
			);
			expect(schema.additionalProperties).toBe(false);
			expect(schema.type).toBe("object");
		}
	});
});
