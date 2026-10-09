/**
 * Types of record fields for the type exporters: what a schema field or an
 * object template value holds once the mock API has generated it.
 */
import { isFakerMethodId } from "./faker-method-catalog.js";
import { fakerMethodKind } from "./faker-method-kinds.js";
import { parseTemplateReference } from "./json-template.js";
import {
	FORBIDDEN_KEYS,
	type JsonObject,
	type JsonValue,
} from "./json-value.js";
import type { ResourceFieldDefinition } from "./resource-constants.js";

export type TypeNode =
	| { readonly kind: "string" | "number" | "boolean" | "null" | "unknown" }
	/** A JSON object with unknown keys. */
	| { readonly kind: "dict" }
	| { readonly kind: "array"; readonly item: TypeNode }
	| { readonly kind: "object"; readonly fields: readonly TypeField[] }
	/** Another resource's record type, by type name. */
	| { readonly kind: "ref"; readonly name: string }
	| { readonly kind: "union"; readonly options: readonly TypeNode[] };

export interface TypeField {
	readonly key: string;
	readonly type: TypeNode;
	/** Shown as a doc comment where the language has one. */
	readonly note?: string;
}

export const STRING: TypeNode = { kind: "string" };
const UNKNOWN: TypeNode = { kind: "unknown" };
export const NULL: TypeNode = { kind: "null" };
export const DICT: TypeNode = { kind: "dict" };
/** Keys that would reach `Object.prototype`; never exported. */
export const SKIPPED_KEYS: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);

function methodType(id: string): TypeNode {
	if (!isFakerMethodId(id)) return NULL;
	const kind = fakerMethodKind(id);
	if (kind === "number" || kind === "boolean") return { kind };
	if (kind === "number-array")
		return { kind: "array", item: { kind: "number" } };
	return kind === "object" ? DICT : STRING;
}

export function union(options: readonly TypeNode[]): TypeNode {
	const unique = new Map(options.map((node) => [JSON.stringify(node), node]));
	const [first, ...rest] = [...unique.values()];
	if (first === undefined) return UNKNOWN;
	return rest.length === 0
		? first
		: { kind: "union", options: [first, ...rest] };
}

/** Fields of a template object, without the `skip` keys. */
export function objectFields(
	value: JsonObject,
	skip: ReadonlySet<string>,
): TypeField[] {
	return Object.entries(value)
		.filter(([key]) => !skip.has(key) && !SKIPPED_KEYS.has(key))
		.map(([key, item]) => templateField(key, item));
}

function methodOf(value: JsonValue): string | null {
	const ref = typeof value === "string" ? parseTemplateReference(value) : null;
	return ref?.kind === "method" ? ref.id : null;
}

function templateField(key: string, value: JsonValue): TypeField {
	const method = methodOf(value);
	const type = templateType(value);
	return method === null
		? { key, type }
		: { key, type, note: `Faker: ${method}` };
}

/** Type of what an object template renders (`"$x.y"` runs Faker). */
function templateType(value: JsonValue): TypeNode {
	if (value === null) return { kind: "null" };
	if (Array.isArray(value)) {
		const items = value.map(templateType);
		return { kind: "array", item: items.length === 0 ? UNKNOWN : union(items) };
	}
	if (typeof value === "object") {
		return { kind: "object", fields: objectFields(value, new Set()) };
	}
	if (typeof value === "number") return { kind: "number" };
	if (typeof value === "boolean") return { kind: "boolean" };
	const method = methodOf(value);
	return method === null ? STRING : methodType(method);
}

const FIELD_TYPES: Readonly<Record<string, TypeNode>> = {
	String: STRING,
	Date: STRING,
	Number: { kind: "number" },
	Boolean: { kind: "boolean" },
	Object: DICT,
	Array: { kind: "array", item: UNKNOWN },
};

export function schemaField(field: ResourceFieldDefinition): TypeField {
	const method = field.fakerMethod ?? "";
	return field.type === "Faker.js"
		? { key: field.name, type: methodType(method), note: `Faker: ${method}` }
		: { key: field.name, type: FIELD_TYPES[field.type] ?? UNKNOWN };
}
