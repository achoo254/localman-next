import { describe, expect, it } from "vitest";
import type {
	CollectionV21Folder,
	CollectionV21Item,
} from "../import/collection-v21-types.js";
import {
	importCollection,
	readFixture,
	withBlankSecrets,
	withoutIds,
} from "../import/import-test-utils.js";
import {
	type CollectionTree,
	type ImportedCollection,
	flattenImportedRequests,
} from "../import/imported-collection.js";
import {
	type EffectiveAuth,
	createRequestDraft,
	emptyRequestBody,
} from "../request-model.js";
import { exportCollectionV21 } from "./collection-v21-export.js";
import { RICH_TREE } from "./round-trip-fixtures.js";
import { v21SchemaErrors } from "./v21-schema-test-utils.js";

function treeOf(imported: ImportedCollection): CollectionTree {
	const { format: _format, warnings: _warnings, ...tree } = imported;
	return tree;
}

/** Exports `tree`, failing on any official schema error, as JSON text. */
function exportChecked(tree: CollectionTree): string {
	const document = exportCollectionV21(tree);
	expect(v21SchemaErrors(document)).toEqual([]);
	return JSON.stringify(document);
}

const roundTrip = (tree: CollectionTree): ImportedCollection =>
	importCollection(exportChecked(tree));

function folderAt(
	items: readonly CollectionV21Item[],
	index: number,
): CollectionV21Folder {
	const item = items[index];
	if (!item || !("item" in item)) throw new Error(`no folder at ${index}`);
	return item;
}

describe("Collection v2.1 lossless round trip", () => {
	it("checks against a schema that rejects the secret variable type", () => {
		const info = { name: "a", schema: "s" };
		const secret = { key: "k", value: "v", type: "secret" };
		expect(v21SchemaErrors({ info, item: [], variable: [secret] })).not.toEqual(
			[],
		);
		expect(v21SchemaErrors({ item: [] })).not.toEqual([]);
	});

	it("imports its export back to the same tree, secrets blank", () => {
		const back = roundTrip(RICH_TREE);
		expect(withoutIds(treeOf(back))).toEqual(
			withoutIds(withBlankSecrets(RICH_TREE)),
		);
		expect(back.variables[1]).toEqual({
			key: "apiKey",
			value: "",
			secret: true,
			enabled: true,
		});
	});

	it("writes no secret value anywhere in the file", () => {
		const text = exportChecked(RICH_TREE);
		expect(RICH_TREE.variables[1]?.value).toBe("k-123");
		expect(text).not.toContain("k-123");
	});

	it("warns only about the files it cannot carry", () => {
		const back = roundTrip(RICH_TREE);
		expect(back.warnings.map((w) => [w.code, w.path])).toEqual([
			["FILE_NOT_INCLUDED", "Users / Admin / Audit / Upload log"],
			["FILE_NOT_INCLUDED", "Avatar"],
		]);
	});

	const collectionAuths: EffectiveAuth[] = [
		{ type: "none" },
		{ type: "bearer", token: "{{token}}" },
		{ type: "basic", username: "u", password: "" },
		{ type: "apikey", key: "key", value: "v", in: "query" },
	];
	it.each(collectionAuths)("keeps collection auth $type", (auth) => {
		expect(roundTrip({ ...RICH_TREE, auth }).auth).toEqual(auth);
	});

	it("writes inherit as no auth and none as noauth", () => {
		const users = folderAt(exportCollectionV21(RICH_TREE).item, 0);
		expect(users.auth).toBeUndefined();
		const admin = folderAt(users.item, 1);
		const audit = folderAt(admin.item, 1);
		expect(admin.auth?.type).toBe("basic");
		expect(audit.auth).toEqual({ type: "noauth" });
		expect(audit.event?.[0]?.listen).toBe("prerequest");
	});

	it("puts secrets and settings v2.1 lacks under _localman", () => {
		const document = exportCollectionV21(RICH_TREE);
		expect(document.variable?.[1]).toEqual({
			key: "apiKey",
			value: "",
			type: "string",
			_localman: { secret: true },
		});
		const text = JSON.stringify(document);
		expect(text).toContain(
			'"_localman":{"timeoutMs":5000,"sendClientIp":false,"route":"proxy"}',
		);
		expect(text).toContain(
			'"protocolProfileBehavior":{"followRedirects":false}',
		);
	});

	it("exports picked files by name and brings the body type back", () => {
		const file = { fileId: "f", name: "a.bin", contentType: "", size: 3 };
		const draft = createRequestDraft({
			name: "Bin",
			body: { ...emptyRequestBody(), type: "binary", binary: file },
		});
		const text = exportChecked({
			...RICH_TREE,
			items: [
				{ kind: "request", id: "b", name: "Bin", description: "", draft },
			],
		});
		expect(text).toContain('"file":{"src":"a.bin"}');
		const back = flattenImportedRequests(importCollection(text));
		expect(back[0]?.draft.body).toMatchObject({ type: "binary", binary: null });
	});

	it("keeps the defaults when _localman holds wrong values", () => {
		const document = exportCollectionV21(RICH_TREE);
		const wrong = { timeoutMs: 10, sendClientIp: "no", route: "tunnel" };
		const item = document.item.map((entry) => ({ ...entry, _localman: wrong }));
		const back = flattenImportedRequests(
			importCollection(JSON.stringify({ ...document, item })),
		);
		expect(back.at(-1)?.draft.settings).toEqual(createRequestDraft().settings);
	});
});

describe("Postman export round trip", () => {
	const fixture = readFixture("collection-v21-nested.json");
	const first = importCollection(fixture);

	it("starts from a valid v2.1 document", () => {
		expect(v21SchemaErrors(JSON.parse(fixture))).toEqual([]);
	});

	it("keeps three folder levels and skips saved responses", () => {
		const flat = flattenImportedRequests(first);
		expect(flat.map((r) => [r.folderPath.join("/"), r.name])).toEqual([
			["Orders", "List orders"],
			["Orders/Fulfilment", "Ship order"],
			["Orders/Fulfilment/Refunds", "Refund order"],
			["Orders/Fulfilment/Refunds", "Refund status"],
			["", "Upload catalog"],
		]);
		expect(flat[3]?.inheritedAuth).toEqual({ type: "none" });
		expect(flat[1]?.draft.url).toBe("{{baseUrl}}/orders/42/ship");
	});

	it("imports, exports and imports to the same tree", () => {
		const second = roundTrip(first);
		expect(withoutIds(treeOf(second))).toEqual(withoutIds(treeOf(first)));
	});

	it("exports the same document on every pass", () => {
		const once = exportChecked(first);
		const twice = exportChecked(importCollection(once));
		expect(JSON.parse(twice)).toEqual(JSON.parse(once));
	});
});
