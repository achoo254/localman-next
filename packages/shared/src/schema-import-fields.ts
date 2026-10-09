/**
 * Shared output of the schema importers (`schema-from-typescript.ts`,
 * `schema-from-openapi.ts`): a source-neutral field shape, the result and
 * error types, and the collector that turns shapes into Localman fields
 * within the schema rules (name pattern, forbidden names, `id`, duplicates,
 * `MAX_SCHEMA_FIELDS`). Zod-free so the light entry point can export it.
 */
import { FORBIDDEN_KEYS } from "./json-value.js";
import {
	FIELD_NAME_MAX,
	type FieldType,
	MAX_SCHEMA_FIELDS,
	OBJECT_ID_FIELD,
	type ResourceFieldDefinition,
} from "./resource-constants.js";
import { fakerHintFor } from "./schema-field-hints.js";

export type ImportedKind =
	| "string"
	| "number"
	| "boolean"
	| "date"
	| "enum"
	| "array"
	| "object"
	| "unknown";

export type EnumValue = string | number | boolean;

/** What a source type says about a field, before mapping to Localman. */
export interface ImportedShape {
	readonly kind: ImportedKind;
	/** OpenAPI `format` (`email`, `uuid`…); drives the Faker suggestion. */
	readonly format?: string;
	/** Allowed values of an `enum` shape. */
	readonly values?: readonly EnumValue[];
}

export interface SchemaImportWarning {
	/** Field or declaration the warning is about, `""` for the input. */
	readonly path: string;
	readonly message: string;
}

export type SchemaImportErrorCode =
	| "INPUT_TOO_LARGE"
	| "INVALID_INPUT"
	| "UNSUPPORTED"
	| "SCHEMA_NOT_FOUND"
	| "TOO_DEEP"
	| "TOO_COMPLEX"
	| "REF_CYCLE"
	| "EXTERNAL_REF"
	| "NO_FIELDS";

export interface SchemaImportError {
	readonly code: SchemaImportErrorCode;
	readonly message: string;
}

export interface SchemaImportSuccess {
	readonly ok: true;
	/** Name of the chosen declaration or schema, when the input has one. */
	readonly name: string | null;
	readonly fields: readonly ResourceFieldDefinition[];
	readonly warnings: readonly SchemaImportWarning[];
}

export type SchemaImportResult =
	| SchemaImportSuccess
	| { readonly ok: false; readonly error: SchemaImportError };

/** Thrown inside an importer and turned into `{ ok: false }` at its boundary. */
export class SchemaImportFailure extends Error {
	constructor(
		readonly code: SchemaImportErrorCode,
		message: string,
	) {
		super(message);
		this.name = "SchemaImportFailure";
	}
}

/** Maps anything an importer threw onto a result; never rethrows. */
export function importFailure(error: unknown): {
	readonly ok: false;
	readonly error: SchemaImportError;
} {
	if (error instanceof SchemaImportFailure) {
		return { ok: false, error: { code: error.code, message: error.message } };
	}
	// Stack overflow or a bug: report a generic error, never the stack.
	return {
		ok: false,
		error: { code: "INVALID_INPUT", message: "The schema could not be read" },
	};
}

const PLAIN_TYPES: Readonly<Record<ImportedKind, FieldType>> = {
	string: "String",
	number: "Number",
	boolean: "Boolean",
	date: "Date",
	enum: "String",
	array: "Array",
	object: "Object",
	unknown: "String",
};
const FORBIDDEN: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);

/** Field name allowed by `FIELD_NAME_PATTERN`: other characters become `_`. */
export function normalizeFieldName(raw: string): string {
	return raw
		.trim()
		.replace(/[^\w\-.]/g, "_")
		.slice(0, FIELD_NAME_MAX);
}

function plainType(shape: ImportedShape): FieldType {
	if (shape.kind !== "enum") return PLAIN_TYPES[shape.kind];
	const values = shape.values ?? [];
	if (values.length > 0 && values.every((v) => typeof v === "number")) {
		return "Number";
	}
	return values.length > 0 && values.every((v) => typeof v === "boolean")
		? "Boolean"
		: "String";
}

/** Collects fields in order, warning about everything it renames or drops. */
export class FieldCollector {
	readonly fields: ResourceFieldDefinition[] = [];
	readonly warnings: SchemaImportWarning[] = [];
	private readonly names = new Set<string>();
	/** Set once a field was refused for `MAX_SCHEMA_FIELDS`. */
	full = false;

	warn(path: string, message: string): void {
		this.warnings.push({ path, message });
	}

	/** Adds a field; returns its final name, or `null` when it was dropped. */
	add(rawName: string, shape: ImportedShape): string | null {
		if (this.full) return null;
		const name = normalizeFieldName(rawName);
		if (!/[A-Za-z0-9]/.test(name)) {
			return this.drop(rawName, "Field name has no letter or digit; skipped");
		}
		if (FORBIDDEN.has(name)) {
			return this.drop(rawName, `Field name "${name}" is not allowed; skipped`);
		}
		if (name === OBJECT_ID_FIELD) {
			return this.drop(rawName, `"${OBJECT_ID_FIELD}" is generated; skipped`);
		}
		if (this.names.has(name)) {
			return this.drop(rawName, `Field "${name}" appears twice; skipped`);
		}
		if (this.fields.length >= MAX_SCHEMA_FIELDS) {
			this.full = true;
			return this.drop(
				"",
				`Only the first ${MAX_SCHEMA_FIELDS} fields were kept`,
			);
		}
		if (name !== rawName) this.warn(rawName, `Renamed to "${name}"`);
		if (shape.kind === "enum") {
			const values = (shape.values ?? []).map(String).join(", ");
			this.warn(name, `Allowed values are not kept: ${values}`);
		}
		if (shape.kind === "unknown") {
			this.warn(name, "Type not recognised; imported as String");
		}
		this.names.add(name);
		const fakerMethod = fakerHintFor(name, shape);
		this.fields.push(
			fakerMethod === null
				? { name, type: plainType(shape) }
				: { name, type: "Faker.js", fakerMethod },
		);
		return name;
	}

	private drop(path: string, message: string): null {
		this.warn(path, message);
		return null;
	}

	/** The result, or `NO_FIELDS` when nothing usable was found. */
	result(name: string | null): SchemaImportSuccess {
		if (this.fields.length === 0) {
			throw new SchemaImportFailure(
				"NO_FIELDS",
				name === null ? "The schema has no fields" : `"${name}" has no fields`,
			);
		}
		return { ok: true, name, fields: this.fields, warnings: this.warnings };
	}
}
