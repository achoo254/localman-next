import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { type JsonRecord, isRecord } from "../../lib/json-guards";
import { resourceErrorMessage } from "./resource-errors";
import type { ImportFormat, ImportWarning } from "./resource-import-api";

/** A parameter as text: lists joined, anything else stringified. */
function text(params: JsonRecord, key: string, joiner = ", "): string {
	const value = params[key];
	if (Array.isArray(value)) return value.map(String).join(joiner);
	return value === undefined || value === null ? "" : String(value);
}

function count(params: JsonRecord, key: string): number {
	const value = Number(params[key]);
	return Number.isFinite(value) ? value : 0;
}

/** A note of the preview in the current language; unknown codes keep the API text. */
export function warningText(warning: ImportWarning, t: Translate): string {
	const { params } = warning;
	const s = (key: string) => text(params, key);
	const n = (key: string) => count(params, key);
	switch (warning.code) {
		case "RENAMED":
			return t("resourceImport.warnings.renamed", {
				from: s("from"),
				to: s("to"),
			});
		case "SKIPPED":
			return t("resourceImport.warnings.skipped", { path: s("path") });
		case "UNSUPPORTED":
			return t("resourceImport.warnings.unsupported", {
				path: s("path"),
				as: s("as"),
			});
		case "MIXED_TYPES":
			return t("resourceImport.warnings.mixedTypes", {
				field: s("field"),
				types: s("types"),
			});
		case "EMPTY_VALUES":
			return t("resourceImport.warnings.emptyValues", {
				field: s("field"),
				as: s("as"),
			});
		case "ENUM_VALUES":
			return t("resourceImport.warnings.enumValues", {
				field: s("field"),
				values: s("values"),
			});
		case "FOREIGN_KEY":
			return t("resourceImport.warnings.foreignKey", { field: s("field") });
		case "KEPT_AS_ARRAY":
			return t("resourceImport.warnings.keptAsArray", { path: s("path") });
		case "NOT_OBJECTS":
			return t("resourceImport.warnings.notObjects", {
				path: s("path"),
				count: n("count"),
			});
		case "TOO_MANY_FIELDS":
			return t("resourceImport.warnings.tooManyFields", { max: n("max") });
		case "TOO_MANY_RESOURCES":
			return t("resourceImport.warnings.tooManyResources", { max: n("max") });
		case "TOO_MANY_RECORDS":
			return t("resourceImport.warnings.tooManyRecords", { max: n("max") });
		case "RESOURCE_TOO_LARGE":
			return t("resourceImport.warnings.resourceTooLarge");
		case "RECORDS_TOO_LARGE":
			return t("resourceImport.warnings.recordsTooLarge", {
				count: n("count"),
			});
		case "DUPLICATE_IDS":
			return t("resourceImport.warnings.duplicateIds", { count: n("count") });
		case "IDS_RENUMBERED":
			return t("resourceImport.warnings.idsRenumbered", { count: n("count") });
		case "CSV_ROW_CELLS":
			return t("resourceImport.warnings.csvRowCells", {
				row: n("row"),
				found: n("found"),
				expected: n("expected"),
			});
		case "CSV_MORE_ROWS":
			return t("resourceImport.warnings.csvMoreRows", { count: n("count") });
		case "MORE_WARNINGS":
			return t("resourceImport.warnings.moreWarnings", { count: n("count") });
		default:
			return warning.message;
	}
}

/** Why the API could not read the source (400/413 `SCHEMA_IMPORT_FAILED`). */
function failureText(
	details: JsonRecord,
	format: ImportFormat,
	t: Translate,
): string | null {
	const s = (key: string) => text(details, key);
	switch (details.reason) {
		case "INPUT_TOO_LARGE":
			return t("resourceImport.errors.inputTooLarge");
		case "INVALID_INPUT":
			if (format === "openapi") return t("resourceImport.errors.notOpenApi");
			return format === "csv"
				? t("resourceImport.errors.invalidCsv")
				: t("resourceImport.errors.invalidJson");
		case "UNSUPPORTED":
			return t("resourceImport.errors.notOpenApi");
		case "SCHEMA_NOT_FOUND":
			return t("resourceImport.errors.schemaNotFound", { name: s("name") });
		case "REF_CYCLE":
			return t("resourceImport.errors.refCycle", {
				cycle: text(details, "cycle", " → "),
			});
		case "EXTERNAL_REF":
			return t("resourceImport.errors.externalRef", { ref: s("ref") });
		case "TOO_DEEP":
			return t("resourceImport.errors.tooDeep", { max: count(details, "max") });
		case "TOO_COMPLEX":
			return t("resourceImport.errors.tooComplex");
		case "NO_FIELDS":
			return t("resourceImport.errors.noFields");
		case "CSV_EMPTY":
			return t("resourceImport.errors.csvEmpty");
		case "CSV_QUOTE":
			return t("resourceImport.errors.csvQuote", {
				row: count(details, "row"),
			});
		case "ENCODING":
			return t("resourceImport.errors.encoding");
		default:
			return null;
	}
}

/**
 * An import error in the current language, by `details.reason` (never the
 * parser's English message); other API errors as for resources.
 */
export function importErrorText(
	error: unknown,
	format: ImportFormat,
	t: Translate,
): string {
	if (error instanceof ApiError) {
		if (error.code === "SCHEMA_IMPORT_FAILED" && isRecord(error.details)) {
			const found = failureText(error.details, format, t);
			if (found) return found;
		}
		// The body limit, not the importer: the encoded request was too big.
		if (error.code === "PAYLOAD_TOO_LARGE") {
			return t("resourceImport.errors.payloadTooLarge");
		}
		if (error.status === 413) return t("resourceImport.errors.inputTooLarge");
	}
	return resourceErrorMessage(error, t);
}
