import { describe, expect, it } from "vitest";
import { utf8ByteLength } from "../byte-encoding.js";
import {
	COLLECTION_DESCRIPTION_MAX,
	COLLECTION_NAME_MAX,
	EXAMPLE_BODY_MAX,
} from "../collections/collection-model.js";
import { collectionTreeSchema } from "../collections/collection-tree-schema.js";
import {
	MAX_ROW_VALUE_LENGTH,
	MAX_SCRIPT_LENGTH,
	MAX_URL_LENGTH,
} from "../limits.js";
import { sliceUnits, sliceUtf8 } from "./fit-text.js";
import { importCollection, readFixture } from "./import-test-utils.js";
import type {
	ImportedCollection,
	ImportedFolder,
	ImportedItem,
	ImportedRequest,
} from "./imported-collection.js";

/** Issues of `tree` against the create-collection schema, as text lines. */
function treeInputIssues(tree: unknown): string[] {
	const result = collectionTreeSchema.safeParse(tree);
	if (result.success) return [];
	return result.error.issues.map(
		(issue) => `${issue.path.join(".")}: ${issue.message}`,
	);
}

const SCHEMA =
	"https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const long = (length: number, char = "a") => char.repeat(length);

/** A valid v2.1 file whose every value breaks a server limit. */
const OVERSIZED = {
	info: {
		name: "  ",
		description: long(COLLECTION_DESCRIPTION_MAX + 1),
		schema: SCHEMA,
	},
	variable: [
		{ key: " ", value: "dropped" },
		{ key: "k", value: long(10_001) },
	],
	event: [{ listen: "test", script: { exec: long(MAX_SCRIPT_LENGTH + 1) } }],
	item: [
		{
			name: "",
			description: long(COLLECTION_DESCRIPTION_MAX + 1),
			item: [
				{
					name: long(COLLECTION_NAME_MAX + 50),
					request: {
						url: `https://a.test/${long(MAX_URL_LENGTH)}`,
						header: [{ key: "X", value: long(MAX_ROW_VALUE_LENGTH + 1) }],
						auth: { type: "bearer", bearer: [{ key: "token", value: "t" }] },
					},
					response: [
						{
							name: " ",
							code: 200,
							status: long(300),
							body: long(300_000, "é"),
						},
					],
				},
				{ name: "", request: { url: "" } },
			],
		},
	],
};

function folderOf(item: ImportedItem | undefined): ImportedFolder {
	if (item?.kind !== "folder") throw new Error("expected a folder");
	return item;
}

function requestOf(item: ImportedItem | undefined): ImportedRequest {
	if (item?.kind !== "request") throw new Error("expected a request");
	return item;
}

describe("fitting an import to the server limits", () => {
	const imported = importCollection(JSON.stringify(OVERSIZED));
	const folder = folderOf(imported.items[0]);
	const big = requestOf(folder.items[0]);
	const empty = requestOf(folder.items[1]);
	const [example] = big.examples;
	if (!example) throw new Error("expected an example");

	it("is accepted by the collection create schema", () => {
		expect(treeInputIssues(imported)).toEqual([]);
	});

	it("names blank items and cuts long names", () => {
		expect(imported.name).toBe("Untitled");
		expect(folder.name).toBe("Untitled");
		expect(empty.name).toBe("Untitled");
		expect(big.name).toHaveLength(COLLECTION_NAME_MAX);
		expect(example.name).toBe(big.name);
	});

	it("cuts an example body by UTF-8 bytes at a character", () => {
		const body = example.response.body;
		expect(utf8ByteLength(body)).toBe(EXAMPLE_BODY_MAX);
		expect(body).toBe(long(EXAMPLE_BODY_MAX / 2, "é"));
		expect(example.response.statusText).toHaveLength(200);
	});

	it("warns about each cut", () => {
		const codes = imported.warnings.map((w) => [w.code, w.params.max]);
		expect(codes).toContainEqual(["EXAMPLE_BODY_TRUNCATED", EXAMPLE_BODY_MAX]);
		expect(codes).toContainEqual(["TEXT_TRUNCATED", COLLECTION_NAME_MAX]);
		expect(codes).toContainEqual(["TEXT_TRUNCATED", MAX_URL_LENGTH]);
		expect(codes).toContainEqual(["TRUNCATED", MAX_SCRIPT_LENGTH]);
		expect(imported.variables.map((v) => [v.key, v.value.length])).toEqual([
			["k", 10_000],
		]);
	});
});

describe("text cuts", () => {
	it("never split a character", () => {
		expect(sliceUnits("a😀b", 2)).toBe("a");
		expect(sliceUnits("a😀b", 3)).toBe("a😀");
		expect(sliceUtf8("😀😀", 7)).toBe("😀");
		expect(sliceUtf8("aé", 2)).toBe("a");
		expect(sliceUtf8("short", 10)).toBe("short");
	});
});

describe("every import fixture", () => {
	const imports: [string, ImportedCollection][] = [
		[
			"v2.1 sample",
			importCollection(readFixture("collection-v21-sample.json")),
		],
		[
			"v2.1 nested",
			importCollection(readFixture("collection-v21-nested.json")),
		],
		["OpenAPI", importCollection(readFixture("openapi-sample.json"))],
		["cURL", importCollection("curl -X POST https://a.test -d x=1")],
	];
	it.each(imports)("%s passes the collection create schema", (_, tree) => {
		expect(treeInputIssues(tree)).toEqual([]);
	});
});
