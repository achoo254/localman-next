import { OperationError } from "@localman/operations";
import type { SchemaImportError } from "@localman/shared";

/**
 * A failed schema import or resource import as an API error:
 * `SCHEMA_IMPORT_FAILED` with flat details `{ reason, ...params }`
 * (`reason` is a `SchemaImportErrorCode`, params name the schema, `$ref`,
 * loop or row involved) so the web app translates it instead of showing
 * the parser's English message. Input over 2 MB answers 413.
 */
export function schemaImportError(error: SchemaImportError): OperationError {
	const status = error.code === "INPUT_TOO_LARGE" ? 413 : 400;
	return new OperationError(status, "SCHEMA_IMPORT_FAILED", error.message, {
		...error.params,
		reason: error.code,
	});
}
