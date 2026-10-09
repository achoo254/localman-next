// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Faker, base, en } from "@faker-js/faker";
import {
	FAKER_METHOD_IDS,
	type JsonObject,
	type ResourceField,
	exportTypeScript,
	exportZodSchemas,
	parentKeyOf,
} from "@localman/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type GenerationSpec, generateRecords } from "./data-generator.js";
import { toRecordView } from "./record-model.js";

/**
 * The exported Zod schemas must accept what the real generator produces:
 * every whitelisted Faker method, every plain field type, an object
 * template and the relation fields the mock API adds.
 */
const USERS = "a".repeat(24);
const POSTS = "b".repeat(24);

const userSchema: ResourceField[] = [
	...FAKER_METHOD_IDS.map(
		(id): ResourceField => ({ name: id, type: "Faker.js", fakerMethod: id }),
	),
	{ name: "label", type: "String" },
	{ name: "n", type: "Number" },
	{ name: "flag", type: "Boolean" },
	{ name: "obj", type: "Object" },
	{ name: "list", type: "Array" },
	{ name: "at", type: "Date" },
	{ name: "posts", type: "Child Resource", childId: POSTS },
];
const postSchema: ResourceField[] = [
	{ name: "author", type: "Parent Resource" },
];
const postTemplate: JsonObject = {
	title: "$lorem.sentence",
	stats: { views: "$datatype.number", ratio: 0.5, tags: ["$lorem.word"] },
	where: "$address.nearbyGPSCoordinate",
	flags: [true, null, "x"],
};

const RESOURCES = [
	{ id: USERS, name: "users", parentId: null, schema: userSchema },
	{
		id: POSTS,
		name: "posts",
		parentId: USERS,
		schema: postSchema,
		template: postTemplate,
	},
];

interface ParseResult {
	readonly success: boolean;
	readonly error?: unknown;
}
interface Parser {
	safeParse(value: unknown): ParseResult;
}

function isParser(value: unknown): value is Parser {
	return (
		typeof value === "object" &&
		value !== null &&
		"safeParse" in value &&
		typeof value.safeParse === "function"
	);
}

let dir = "";
let schemas: Record<string, unknown> = {};

/** Writes generated code to a temp module and imports it. */
async function load(
	name: string,
	code: string,
): Promise<Record<string, unknown>> {
	const file = join(dir, name);
	await writeFile(file, code, "utf8");
	const loaded: unknown = await import(/* @vite-ignore */ file);
	return typeof loaded === "object" && loaded !== null ? { ...loaded } : {};
}

function parser(name: string): Parser {
	const candidate = schemas[name];
	if (!isParser(candidate)) throw new Error(`${name} is not a Zod schema`);
	return candidate;
}

beforeAll(async () => {
	// Vite only loads files inside the workspace, and from the app's
	// git-ignored cache the module resolves the app's own "zod".
	const cache = fileURLToPath(
		new URL("../../../node_modules/.cache/", import.meta.url),
	);
	await mkdir(cache, { recursive: true });
	dir = await mkdtemp(join(cache, "localman-type-export-"));
	schemas = await load("schemas.ts", exportZodSchemas(RESOURCES));
});

afterAll(async () => {
	if (dir) await rm(dir, { recursive: true, force: true });
});

function generate(
	spec: Omit<GenerationSpec, "resource">,
	parents: string[] | null,
) {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(42);
	return generateRecords(
		{ ...spec, resource: { id: "r", name: "r" } },
		20,
		parents,
		faker,
	);
}

describe("exported Zod schemas", () => {
	it("parse generated records and the relation fields the mock API adds", () => {
		const users = generate(
			{ schema: userSchema, template: null, parentKey: null },
			null,
		).map((record) => toRecordView(record, null));
		const postKey = parentKeyOf("users");
		const posts = generate(
			{ schema: postSchema, template: postTemplate, parentKey: postKey },
			users.map((user) => String(user.id)),
		).map((record) => toRecordView(record, postKey));

		for (const user of users) {
			expect(parser("userRecordSchema").safeParse(user)).toMatchObject({
				success: true,
			});
			const own = posts.filter((post) => post[postKey] === user.id);
			const full = { ...user, posts: own };
			const result = parser("userSchema").safeParse(full);
			expect(result.error).toBeUndefined();
		}
		for (const post of posts) {
			const author = users.find((user) => user.id === post[postKey]) ?? null;
			const result = parser("postSchema").safeParse({ ...post, author });
			expect(result.error).toBeUndefined();
			expect(
				parser("postSchema").safeParse({ ...post, author: null }).success,
			).toBe(true);
		}
	});

	it("reject a record of the wrong shape", () => {
		expect(parser("postRecordSchema").safeParse({ id: 1 }).success).toBe(false);
	});

	it("TypeScript output is valid module syntax", async () => {
		await expect(
			load("types.ts", exportTypeScript(RESOURCES)),
		).resolves.toEqual({});
	});
});
