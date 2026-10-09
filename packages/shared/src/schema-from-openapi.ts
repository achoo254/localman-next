/**
 * Localman schema fields from an OpenAPI 3.x document, one of its Schema
 * Objects, or a JSON Schema, for MCP `create_resource` and the import of
 * phase 19 (which maps `references` onto resource relations). Handles
 * local `$ref`, `type` (also 3.1 type arrays), `format`, `enum`/`const`,
 * `items`, `nullable`, `allOf` and the first branch of `oneOf`/`anyOf`.
 * Work is bounded by depth, step and size limits; errors are returned.
 */
import { type JsonObject, isJsonObject } from "./json-value.js";
import {
	type OpenApiImportOptions,
	chooseSchema,
	readOpenApiInput,
} from "./openapi-document.js";
import { componentName, deref } from "./openapi-ref.js";
import { SchemaWalker } from "./openapi-schema-walker.js";
import {
	type SchemaImportError,
	SchemaImportFailure,
	importFailure,
} from "./schema-import-errors.js";
import {
	FieldCollector,
	type SchemaImportSuccess,
} from "./schema-import-fields.js";

/** A field whose schema is a component: a relation candidate. */
export interface OpenApiReference {
	readonly field: string;
	/** Name in `components.schemas`. */
	readonly schema: string;
	/** `true` for an array of the component. */
	readonly many: boolean;
}

type Imported = SchemaImportSuccess & {
	readonly references: readonly OpenApiReference[];
};

export type OpenApiImportResult =
	| Imported
	| { readonly ok: false; readonly error: SchemaImportError };

/**
 * Fields of the schema `options` choose (default: the first component,
 * else the first path's JSON body). An array schema imports its items.
 */
export function schemaFromOpenApi(
	input: unknown,
	options: OpenApiImportOptions = {},
): OpenApiImportResult {
	try {
		const root = readOpenApiInput(input);
		return importOpenApiSchema(root, new SchemaWalker(root), options);
	} catch (error) {
		return importFailure(error);
	}
}

/**
 * `schemaFromOpenApi` on a document already read by `readOpenApiInput`,
 * with a walker that may be shared by several imports of that document
 * (one step budget, `$ref` merges walked once). Throws
 * `SchemaImportFailure`.
 */
export function importOpenApiSchema(
	root: JsonObject,
	walker: SchemaWalker,
	options: OpenApiImportOptions,
): Imported {
	const choice = chooseSchema(root, options);
	const { name } = choice;
	let schema = choice.schema;
	let { shape } = walker.shape(schema);
	if (shape.kind === "array") {
		const resolved = deref(root, schema).value;
		const hasItems = isJsonObject(resolved) && Object.hasOwn(resolved, "items");
		schema = hasItems ? resolved.items : {};
		({ shape } = walker.shape(schema));
	}
	if (shape.kind !== "object") {
		throw new SchemaImportFailure(
			"UNSUPPORTED",
			`${name ?? "The schema"} is not an object schema`,
		);
	}
	const fields = new FieldCollector();
	const references: OpenApiReference[] = [];
	for (const [key, property] of walker.properties(schema)) {
		if (fields.full) break;
		const walked = walker.shape(property);
		const field = fields.add(key, walked.shape);
		const target = componentName(walked.ref);
		const kind = walked.shape.kind;
		if (
			field !== null &&
			target !== null &&
			(kind === "object" || kind === "array")
		) {
			references.push({ field, schema: target, many: kind === "array" });
		}
	}
	return { ...fields.result(name), references };
}
