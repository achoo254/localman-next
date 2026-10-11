import { describe, expect, it } from "vitest";
import { EXAMPLE_BODY_MAX } from "../collections/collection-model.js";
import type { CollectionV21Item } from "../import/collection-v21-types.js";
import { importCollection } from "../import/import-test-utils.js";
import type {
	CollectionTree,
	ImportedCollection,
	ImportedRequest,
} from "../import/imported-collection.js";
import { exportCollectionV21 } from "./collection-v21-export.js";
import { RICH_TREE } from "./round-trip-fixtures.js";
import { request } from "./tree-builders-test-utils.js";
import { exportChecked, roundTrip } from "./v21-schema-test-utils.js";

const SMALL: CollectionTree = {
	...RICH_TREE,
	variables: [],
	tags: [],
	status: null,
	items: [request("Ping", { url: "https://a.test/ping" })],
};

/** `SMALL` exported, `collection` and `item` spread over the document and its item, imported. */
function importChanged(
	collection: Record<string, unknown>,
	item: Record<string, unknown> = {},
): ImportedCollection {
	const document = exportCollectionV21(SMALL);
	const items = document.item.map((entry: CollectionV21Item) => ({
		...entry,
		...item,
	}));
	return importCollection(
		JSON.stringify({ ...document, ...collection, item: items }),
	);
}

const warningsOf = (imported: ImportedCollection) =>
	imported.warnings.map((w) => [w.code, w.params]);

function firstRequest(imported: ImportedCollection): ImportedRequest {
	const item = imported.items[0];
	if (item?.kind !== "request") throw new Error("no request");
	return item;
}

describe("saved examples", () => {
	it("writes them as response[] entries", () => {
		const text = exportChecked(RICH_TREE);
		expect(text).toContain(
			'"status":"OK","code":200,"header":[{"key":"Content-Type","value":"application/json"},{"key":"X-Cache","value":"HIT","disabled":true,"description":"CDN"}],"body":"[{\\"id\\":1},{\\"id\\":2}]","_postman_previewlanguage":"json"',
		);
	});

	it("cuts a body over the limit with a warning", () => {
		const body = "a".repeat(EXAMPLE_BODY_MAX + 5);
		const imported = importChanged({}, { response: [{ name: "Big", body }] });
		const [big] = firstRequest(imported).examples;
		expect(big?.response.body).toBe(body.slice(0, EXAMPLE_BODY_MAX));
		expect(warningsOf(imported)).toEqual([
			["EXAMPLE_BODY_TRUNCATED", { max: EXAMPLE_BODY_MAX }],
		]);
	});

	it("reads odd entries without failing", () => {
		const imported = importChanged(
			{},
			{ response: ["x", null, { code: 99, header: "X-A: 1\nX-B: 2" }] },
		);
		const item = firstRequest(imported);
		expect(item.examples).toHaveLength(1);
		expect(item.examples[0]?.response).toMatchObject({
			status: 200,
			statusText: "",
			body: "",
			bodyLanguage: "text",
		});
		expect(item.examples[0]?.response.headers.map((h) => h.key)).toEqual([
			"X-A",
			"X-B",
		]);
		expect(item.examples[0]?.request.url).toBe("https://a.test/ping");
	});
});

describe("tags and status", () => {
	it("round-trips a preset status and leaves out what is empty", () => {
		const status = { kind: "preset", preset: "deprecated" } as const;
		expect(roundTrip({ ...SMALL, status }).status).toEqual(status);
		expect(exportCollectionV21(SMALL)).not.toHaveProperty("_localman");
	});

	it("normalizes tags and drops invalid ones with a warning", () => {
		const imported = importChanged({
			_localman: {
				tags: ["Billing", "billing", " V2 ", "-bad-", 7],
				status: { kind: "custom", name: "x", emoji: "🚧" },
			},
		});
		expect(imported.tags).toEqual(["billing", "v2"]);
		expect(imported.status).toBeNull();
		expect(warningsOf(imported)).toEqual([
			["INVALID_METADATA", { field: "tags" }],
			["INVALID_METADATA", { field: "status" }],
		]);
	});

	it("keeps the first ten tags", () => {
		const tags = Array.from({ length: 12 }, (_, i) => `t${i}`);
		const imported = importChanged({ _localman: { tags } });
		expect(imported.tags).toEqual(tags.slice(0, 10));
		expect(warningsOf(imported)).toEqual([
			["INVALID_METADATA", { field: "tags" }],
		]);
	});
});
