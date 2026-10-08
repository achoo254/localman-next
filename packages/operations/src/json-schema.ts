import { z } from "zod";

export type JsonSchema = z.core.JSONSchema.BaseSchema;

/**
 * JSON Schema (draft 2020-12, the dialect of OpenAPI 3.1) describing what a
 * caller sends. Throws when the schema has no JSON representation
 * (e.g. `z.date()`), so registries fail at definition time.
 */
export function toInputJsonSchema(schema: z.ZodType): JsonSchema {
	const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
		io: "input",
	});
	return rest;
}

/** JSON Schema describing what the API returns. */
export function toOutputJsonSchema(schema: z.ZodType): JsonSchema {
	const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
		io: "output",
	});
	return rest;
}
