/**
 * Export test helpers. Validation against the official Collection v2.1.0 JSON Schema (draft-04),
 * for tests only. The schema in `__fixtures__/collection-v2.1.0.schema.json`
 * is copied from
 * https://schema.postman.com/json/collection/v2.1.0/collection.json
 * (postmanlabs/schemas, Apache License 2.0).
 */
import { readFileSync } from "node:fs";
import ajvDraft04 from "ajv-draft-04";
import { expect } from "vitest";
import { importCollection } from "../import/import-test-utils.js";
import type {
	CollectionTree,
	ImportedCollection,
} from "../import/imported-collection.js";
import { exportCollectionV21 } from "./collection-v21-export.js";

// A CommonJS package: under NodeNext its default import is `module.exports`,
// which carries the class as `default`.
const Ajv = ajvDraft04.default;

const schema: unknown = JSON.parse(
	readFileSync(
		new URL("./__fixtures__/collection-v2.1.0.schema.json", import.meta.url),
		"utf8",
	),
);

function isSchemaObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (!isSchemaObject(schema)) throw new Error("schema fixture is not an object");

// `strict: false`: strict mode rejects the schema itself (`anyOf` branches
// of `variable` require properties declared only in the parent).
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

/** Schema errors of `document` as `path message` lines; empty when valid. */
export function v21SchemaErrors(document: unknown): string[] {
	if (validate(document)) return [];
	return (validate.errors ?? []).map(
		(error) => `${error.instancePath || "/"} ${error.message ?? ""}`,
	);
}

/** The tree part of an import (no format, no warnings). */
export function treeOf(imported: ImportedCollection): CollectionTree {
	const { format: _format, warnings: _warnings, ...tree } = imported;
	return tree;
}

/** Exports `tree`, failing on any official schema error, as JSON text. */
export function exportChecked(tree: CollectionTree): string {
	const document = exportCollectionV21(tree);
	expect(v21SchemaErrors(document)).toEqual([]);
	return JSON.stringify(document);
}

export const roundTrip = (tree: CollectionTree): ImportedCollection =>
	importCollection(exportChecked(tree));
