import {
	type JsonObject,
	OBJECT_ID_FIELD,
	RELATION_FIELD_TYPES,
	type ResourceFieldDefinition,
} from "@localman/shared";

export type JsonSchemaType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "object"
	| "array";

/** The JSON Schema 2020-12 keywords the mock tools use. */
export interface JsonSchema {
	readonly type?: JsonSchemaType | readonly JsonSchemaType[];
	readonly description?: string;
	readonly format?: string;
	readonly pattern?: string;
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly minimum?: number;
	readonly maximum?: number;
	readonly maxProperties?: number;
	readonly enum?: readonly string[];
	readonly properties?: Readonly<Record<string, JsonSchema>>;
	readonly required?: readonly string[];
	readonly additionalProperties?: boolean;
}

/** What the input schemas need of a resource. */
export interface ToolShape {
	readonly schema: readonly ResourceFieldDefinition[];
	readonly template: JsonObject | null;
	/** `{parent}Id` of its records, `null` for a root resource. */
	readonly parentKey: string | null;
	/** Name of the parent resource, `null` for a root resource. */
	readonly parentName: string | null;
}

/** A stored field: a schema field, or a key of the object template. */
export type DataField = ResourceFieldDefinition | string;

const ANY_SCALAR: readonly JsonSchemaType[] = ["string", "number", "boolean"];

export function fieldName(field: DataField): string {
	return typeof field === "string" ? field : field.name;
}

/**
 * Fields a record stores, as the mock runtime sees them (`dataFieldsOf`
 * in `mock-runtime/mock-records.ts`): the template keys when there is a
 * template, else the schema without relation fields. `id` and
 * `{parent}Id` are system fields the runtime drops from bodies.
 */
export function dataFields(shape: ToolShape): DataField[] {
	const isSystem = (name: string): boolean =>
		name === OBJECT_ID_FIELD || name === shape.parentKey;
	if (shape.template) {
		return Object.keys(shape.template).filter((key) => !isSystem(key));
	}
	return shape.schema.filter(
		(field) => !RELATION_FIELD_TYPES.has(field.type) && !isSystem(field.name),
	);
}

/**
 * Names the REST list refuses as a query key or `sortBy` value (see
 * `isUnsafeName` in `mock-runtime/query-engine.ts`); field names may
 * contain `.`, so such fields cannot be filtered or sorted on.
 */
export function isQuerySafe(name: string): boolean {
	return !name.startsWith("$") && !/[.[\]]/.test(name);
}

/** Value of a field in a create/update body. */
export function fieldValueSchema(field: DataField): JsonSchema {
	if (typeof field === "string") return {};
	switch (field.type) {
		case "String":
			return { type: "string" };
		case "Number":
			return { type: "number" };
		case "Boolean":
			return { type: "boolean" };
		case "Object":
			return { type: "object" };
		case "Array":
			return { type: "array" };
		case "Date":
			return { type: "string", format: "date-time" };
		default:
			return {
				description: `Any JSON value; generated with Faker ${field.fakerMethod ?? ""}`,
			};
	}
}

/** How `matchesFilter` compares a filter of `type` to the stored value. */
export function filterDescription(
	name: string,
	type: JsonSchemaType | readonly JsonSchemaType[],
): string {
	let how = "substring for text, exact otherwise";
	if (type === "string") how = "case-insensitive substring";
	else if (typeof type === "string") how = "exact";
	return `Filter on "${name}" (${how})`;
}

/**
 * Type of a `<field>=` filter value, or `null` when the field cannot be
 * filtered: `matchesFilter` never matches objects and arrays. Values of
 * template keys are typed by the template literal; a Faker reference
 * (or `null`) may produce any scalar.
 */
export function filterType(
	field: DataField,
	template: JsonObject | null,
): JsonSchemaType | readonly JsonSchemaType[] | null {
	if (typeof field === "string") {
		const value = template?.[field];
		if (typeof value === "number") return "number";
		if (typeof value === "boolean") return "boolean";
		if (typeof value === "string") {
			return value.startsWith("$") ? ANY_SCALAR : "string";
		}
		return value === null ? ANY_SCALAR : null;
	}
	switch (field.type) {
		case "String":
		case "Date":
			return "string";
		case "Number":
			return "number";
		case "Boolean":
			return "boolean";
		case "Faker.js":
			return ANY_SCALAR;
		default:
			return null;
	}
}
