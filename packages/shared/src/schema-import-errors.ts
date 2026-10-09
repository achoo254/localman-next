/**
 * Errors and warnings of the schema importers and of the resource import
 * (`schema-inference.ts`). Each carries a stable `code` and `params` the
 * web app translates, plus an English `message` for MCP clients and as a
 * fallback. Params hold names from the input (cut to 200 characters) and
 * numbers only, never values of records.
 */

/** Values filled into a translated message (`{from}`, `{max}`…). */
export type ImportParams = Readonly<Record<string, string | number>>;

export type SchemaImportWarningCode =
	/** `{ from, to }`: a field or resource name changed to fit the rules. */
	| "RENAMED"
	/** `{ path }`: a field, column, member, schema or item was left out. */
	| "SKIPPED"
	/** `{ path, as }`: a type Localman cannot map, imported as `as`. */
	| "UNSUPPORTED"
	/** `{ field, types }`: values of several types, imported as String. */
	| "MIXED_TYPES"
	/** `{ field, as }`: only null, missing or empty values; imported as `as`. */
	| "EMPTY_VALUES"
	/** `{ field, values }`: the allowed values of an enum are not kept. */
	| "ENUM_VALUES"
	/** `{ field }`: looks like the id of another resource. */
	| "FOREIGN_KEY"
	/** `{ path }`: a nested list stayed an Array field, not a resource. */
	| "KEPT_AS_ARRAY"
	/** `{ path, count }`: items of a list that are not objects. */
	| "NOT_OBJECTS"
	/** `{ max }`: only the first `max` fields were kept. */
	| "TOO_MANY_FIELDS"
	/** `{ max }`: only the first `max` resources were kept. */
	| "TOO_MANY_RESOURCES"
	/** `{ max }`: only the first `max` records or rows were kept. */
	| "TOO_MANY_RECORDS"
	/** `{ max }`: records past `max` bytes of a resource were not kept. */
	| "RESOURCE_TOO_LARGE"
	/** `{ count }`: records over the record size or depth cap, skipped. */
	| "RECORDS_TOO_LARGE"
	/** `{ count }`: records repeating an id, skipped. */
	| "DUPLICATE_IDS"
	/** `{ count }`: records with an unusable id, numbered instead. */
	| "IDS_RENUMBERED"
	/** `{ row, found, expected }`: a CSV row with a wrong number of cells. */
	| "CSV_ROW_CELLS"
	/** `{ count }`: more CSV rows with a wrong number of cells. */
	| "CSV_MORE_ROWS"
	/** `{ count }`: warnings past the cap, not listed. */
	| "MORE_WARNINGS";

export interface SchemaImportWarning {
	/** Field or declaration the warning is about, `""` for the input. */
	readonly path: string;
	readonly code: SchemaImportWarningCode;
	readonly params: ImportParams;
	readonly message: string;
}

export type SchemaImportErrorCode =
	/** `{ max }` bytes. */
	| "INPUT_TOO_LARGE"
	| "INVALID_INPUT"
	| "UNSUPPORTED"
	/** `{ name }` when a named schema or `$ref` target is missing. */
	| "SCHEMA_NOT_FOUND"
	/** `{ max }` levels. */
	| "TOO_DEEP"
	| "TOO_COMPLEX"
	/** `{ cycle }`: the schemas of the loop, `A → B → A`. */
	| "REF_CYCLE"
	/** `{ ref }`: the `$ref` pointing outside the document. */
	| "EXTERNAL_REF"
	| "NO_FIELDS"
	/** The CSV has no header or data row. */
	| "CSV_EMPTY"
	/** `{ row }`: a quoted cell opened on that row is never closed. */
	| "CSV_QUOTE"
	/** The text is not UTF-8 (replacement or NUL characters). */
	| "ENCODING"
	/** JSON that is neither an object nor an array of objects. */
	| "JSON_SHAPE"
	/** An empty JSON array: no fields to read. */
	| "JSON_EMPTY";

export interface SchemaImportError {
	readonly code: SchemaImportErrorCode;
	readonly message: string;
	readonly params: ImportParams;
}

/** Thrown inside an importer and turned into `{ ok: false }` at its boundary. */
export class SchemaImportFailure extends Error {
	constructor(
		readonly code: SchemaImportErrorCode,
		message: string,
		readonly params: ImportParams = {},
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
		const { code, message, params } = error;
		return { ok: false, error: { code, message, params } };
	}
	// Stack overflow or a bug: report a generic error, never the stack.
	return {
		ok: false,
		error: {
			code: "INVALID_INPUT",
			message: "The schema could not be read",
			params: {},
		},
	};
}

/** Names from the input as message params: cut to 200 characters. */
export const paramText = (text: string): string => text.slice(0, 200);
