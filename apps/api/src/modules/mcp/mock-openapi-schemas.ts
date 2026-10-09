import { OBJECT_ID_FIELD } from "@localman/shared";
import {
	type JsonSchema,
	type ToolShape,
	dataFields,
	fieldName,
	fieldValueSchema,
} from "./mock-tool-fields.js";

/** An OpenAPI 3.1 schema (JSON Schema 2020-12), `$ref` or array of either. */
export type SchemaObject =
	| JsonSchema
	| { readonly $ref: string }
	| { readonly type: "array"; readonly items: SchemaObject };

export function refTo(component: string): { readonly $ref: string } {
	return { $ref: `#/components/schemas/${component}` };
}

/**
 * Fields resolved per response and never stored: `Parent Resource`
 * embeds the parent record, `Child Resource` lists child records.
 */
function relationProperties(shape: ToolShape): Record<string, JsonSchema> {
	if (shape.template) return {};
	const properties: Record<string, JsonSchema> = {};
	for (const field of shape.schema) {
		if (field.type === "Parent Resource") {
			properties[field.name] = {
				type: "object",
				description: `The parent "${shape.parentName ?? ""}" record`,
			};
		} else if (field.type === "Child Resource") {
			properties[field.name] = {
				type: "array",
				description: "Records of a child resource",
			};
		}
	}
	return properties;
}

function fieldProperties(shape: ToolShape): Record<string, JsonSchema> {
	return Object.fromEntries(
		dataFields(shape).map((field) => [
			fieldName(field),
			fieldValueSchema(field),
		]),
	);
}

/**
 * A record as the REST API returns it: `id`, the `{parent}Id` of a
 * nested resource, the stored fields and the relation fields. Other
 * keys may appear (data pasted in the dashboard is kept as sent).
 */
export function recordSchema(shape: ToolShape): JsonSchema {
	const system: Record<string, JsonSchema> = {
		[OBJECT_ID_FIELD]: { type: "string", description: "Assigned by the mock" },
	};
	if (shape.parentKey !== null) {
		system[shape.parentKey] = {
			type: "string",
			description: `Id of the parent "${shape.parentName ?? ""}" record`,
		};
	}
	return {
		type: "object",
		properties: {
			...system,
			...fieldProperties(shape),
			...relationProperties(shape),
		},
		required: [OBJECT_ID_FIELD],
		additionalProperties: true,
	};
}

/**
 * Body of POST, PUT and PATCH: the stored fields, all optional (POST
 * generates missing ones, PUT/PATCH merge). `id`, `{parent}Id` and
 * relation fields are ignored when sent.
 */
export function recordInputSchema(shape: ToolShape): JsonSchema {
	return {
		type: "object",
		properties: fieldProperties(shape),
		additionalProperties: true,
	};
}

/** `{ error: { code, message, details? } }` of every API error but 404. */
export const ERROR_SCHEMA: JsonSchema = {
	type: "object",
	properties: {
		error: {
			type: "object",
			properties: {
				code: { type: "string" },
				message: { type: "string" },
			},
			required: ["code", "message"],
		},
	},
	required: ["error"],
};
