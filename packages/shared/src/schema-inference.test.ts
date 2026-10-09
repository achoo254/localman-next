import { describe, expect, it } from "vitest";
import { MAX_RECORDS_PER_RESOURCE } from "./resource-constants.js";
import { resourcesOf } from "./schema-inference-test-utils.js";
import {
	MAX_INFERENCE_BYTES,
	MAX_INFERRED_RESOURCES,
	type SchemaInferenceResult,
	inferSchema,
} from "./schema-inference.js";

const errorOf = (result: SchemaInferenceResult) =>
	result.ok ? null : result.error.code;

const USERS = [
	{
		id: 1,
		name: "Ann",
		email: "ann@example.com",
		website: "https://ann.dev",
		mixed: 31,
		active: true,
		when: "2024-05-01T10:00:00Z",
		address: { city: "Hanoi" },
		tags: [],
		nothing: null,
		posts: [
			{ id: "p1", title: "Hi", userId: 1, comments: [{ text: "Nice" }] },
			{ id: "p2", title: "Again", userId: 1, comments: [] },
		],
	},
	{
		id: 2,
		name: "Bob",
		email: "bob@example.com",
		mixed: 40,
		active: false,
		posts: [],
	},
	{
		name: "Cy",
		email: "cy@example.com",
		mixed: "n/a",
		posts: [{ title: "Yo" }],
	},
];

describe("inferSchema from a JSON sample", () => {
	it("infers types, seed records and child resources from nested arrays", () => {
		const result = inferSchema(JSON.stringify(USERS), { name: "users" });
		const [users, posts, comments, ...rest] = resourcesOf(result);
		expect(rest).toEqual([]);
		// `name` gets whatever Faker method the name matcher picks.
		expect(users?.fields.slice(1)).toEqual([
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			{ name: "website", type: "Faker.js", fakerMethod: "internet.url" },
			{ name: "mixed", type: "String" },
			{ name: "active", type: "Boolean" },
			{ name: "when", type: "Date" },
			{ name: "address", type: "Object" },
			{ name: "tags", type: "Array" },
			{ name: "nothing", type: "String" },
		]);
		expect(users?.fields[0]?.name).toBe("name");
		expect(users?.parentName).toBeNull();
		expect(users?.records?.map((r) => r.id)).toEqual([1, 2, "3"]);
		expect(users?.records?.[0]).not.toHaveProperty("posts");
		expect(posts).toMatchObject({
			name: "posts",
			parentName: "users",
			parentField: "posts",
		});
		expect(posts?.fields.map((field) => field.name)).toEqual(["title"]);
		expect(posts?.records).toEqual([
			{ id: "p1", userId: 1, title: "Hi" },
			{ id: "p2", userId: 1, title: "Again" },
			{ id: "1", userId: "3", title: "Yo" },
		]);
		expect(comments).toMatchObject({ name: "comments", parentName: "posts" });
		expect(comments?.records).toEqual([
			{ id: "1", postId: "p1", text: "Nice" },
		]);
		const warnings = result.ok ? result.warnings : [];
		expect(warnings).toEqual(
			expect.arrayContaining([
				{
					path: "users.mixed",
					code: "MIXED_TYPES",
					params: { field: "mixed", types: "number, string" },
					message: "Mixed types (number, string); imported as String",
				},
				{
					path: "users.tags",
					code: "EMPTY_VALUES",
					params: { field: "tags", as: "Array" },
					message: "Only empty arrays; imported as Array",
				},
				{
					path: "users.nothing",
					code: "EMPTY_VALUES",
					params: { field: "nothing", as: "String" },
					message: "Only null or missing values; imported as String",
				},
			]),
		);
	});

	it("reads one object, a db.json of collections, and parsed values", () => {
		const [one] = resourcesOf(inferSchema({ title: "x", price: 9.5 }));
		expect(one).toMatchObject({
			name: "items",
			records: [{ id: "1", title: "x", price: 9.5 }],
		});
		const db = resourcesOf(
			inferSchema('\uFEFF{"users":[{"name":"a"}],"mcp":[{"x":1}],"empty":[]}'),
		);
		expect(db.map((r) => r.name)).toEqual(["users", "mcp_2"]);
	});

	it("keeps ids unique, renumbers invalid ones and flags foreign keys", () => {
		const result = inferSchema([
			{ id: "a b", authorId: 7, n: 1 },
			{ id: 5, authorId: 8, n: 2 },
			{ id: 5, n: 3 },
		]);
		const [items] = resourcesOf(result);
		expect(items?.records?.map((r) => r.id)).toEqual(["6", 5]);
		expect(result.ok && result.warnings.map((w) => w.message)).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/key of another resource/),
				"1 records had an invalid id and were numbered",
				"1 records repeat an id and were skipped",
			]),
		);
	});

	it("caps records, fields and resources", () => {
		const many = Array.from(
			{ length: MAX_RECORDS_PER_RESOURCE + 5 },
			(_, i) => ({ n: i }),
		);
		const [items] = resourcesOf(inferSchema(many));
		expect(items?.records).toHaveLength(MAX_RECORDS_PER_RESOURCE);
		const wide = Object.fromEntries(
			Array.from({ length: 80 }, (_, i) => [`f${i}`, i]),
		);
		expect(resourcesOf(inferSchema(wide))[0]?.fields).toHaveLength(50);
		let deep: Record<string, unknown> = { leaf: 1 };
		for (let i = 0; i < 15; i += 1) deep = { name: `l${i}`, [`c${i}`]: [deep] };
		expect(resourcesOf(inferSchema(deep)).length).toBe(10);
		const wideTree = Object.fromEntries(
			Array.from({ length: 60 }, (_, i) => [`r${i}`, [{ v: i }]]),
		);
		expect(resourcesOf(inferSchema(wideTree))).toHaveLength(
			MAX_INFERRED_RESOURCES,
		);
	});

	it("refuses input over 2 MB, before parsing", () => {
		const big = `[${'{"a":"x"},'.repeat(MAX_INFERENCE_BYTES / 10)}{"a":"x"}]`;
		expect(errorOf(inferSchema(big))).toBe("INPUT_TOO_LARGE");
		expect(errorOf(inferSchema("é".repeat(MAX_INFERENCE_BYTES / 2 + 1)))).toBe(
			"INPUT_TOO_LARGE",
		);
		const parsed = Array.from({ length: 300 }, () => ({ a: "x".repeat(8000) }));
		expect(errorOf(inferSchema(parsed))).toBe("INPUT_TOO_LARGE");
	});

	it("refuses malicious or unusable JSON with a clear error", () => {
		const cases: [unknown, string][] = [
			['{"__proto__":{"polluted":1}}', "INVALID_INPUT"],
			[[{ constructor: 1 }], "INVALID_INPUT"],
			[JSON.parse('{"a":{"prototype":1}}'), "INVALID_INPUT"],
			[`${"[".repeat(100)}${"]".repeat(100)}`, "INVALID_INPUT"],
			["{not json", "INVALID_INPUT"],
			["[1, 2]", "JSON_SHAPE"],
			["[]", "JSON_EMPTY"],
			[[{ id: 1 }], "NO_FIELDS"],
			[{ fn: () => 1 }, "INVALID_INPUT"],
			[42, "JSON_SHAPE"],
		];
		for (const [input, code] of cases) {
			expect(errorOf(inferSchema(input)), String(input)).toBe(code);
		}
		expect(Object.prototype).not.toHaveProperty("polluted");
	});

	it("normalizes field names and refuses forbidden ones in nested data", () => {
		const result = inferSchema([
			{ "first name": "A", "": 1, "a/b": { constructor: 1 } },
		]);
		expect(errorOf(result)).toBe("INVALID_INPUT");
		const [items] = resourcesOf(inferSchema([{ "first name": "A", "%%": 1 }]));
		expect(items?.fields.map((field) => field.name)).toEqual(["first_name"]);
		expect(items?.records).toEqual([{ id: "1", first_name: "A" }]);
	});
});
