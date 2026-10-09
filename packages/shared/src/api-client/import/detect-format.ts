/**
 * Which importer reads an input: a `curl` command, or JSON that is a v2.x
 * collection, a v2.1 environment or an OpenAPI 3.x document. YAML and
 * versions the importers do not read fail with their own code, so the UI
 * can say what to do instead of "unknown format".
 */
import { COLLECTION_V2_SCHEMA_PATTERN } from "./collection-v21-types.js";
import { looksLikeCurl } from "./curl-parser.js";
import { RequestImportFailure } from "./import-error.js";
import { isRecord, listProp, prop, recordProp, textOf } from "./import-json.js";
import type { CollectionImportFormat } from "./imported-collection.js";

export type ImportFormat = CollectionImportFormat | "environment-v21";

/** A text that starts like a YAML mapping (`openapi: 3.0.0`, `---`). */
export function looksLikeYaml(text: string): boolean {
	const first = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line !== "" && !line.startsWith("#"));
	return (
		first !== undefined &&
		/^(---|%YAML|["']?[\w$.-]+["']?\s*:(\s|$))/.test(first)
	);
}

/** Format of a text that is not JSON; throws when it is none we read. */
export function detectTextFormat(text: string): "curl" | "json" {
	const trimmed = text.trim();
	if (looksLikeCurl(trimmed)) return "curl";
	if (/^[[{]/.test(trimmed)) return "json";
	throw new RequestImportFailure(
		looksLikeYaml(trimmed) ? "YAML_NOT_SUPPORTED" : "UNKNOWN_FORMAT",
	);
}

/** Format of parsed JSON; throws `UNSUPPORTED_VERSION` or `UNKNOWN_FORMAT`. */
export function detectJsonFormat(value: unknown): ImportFormat {
	if (!isRecord(value)) throw new RequestImportFailure("UNKNOWN_FORMAT");
	const openapi = prop(value, "openapi");
	if (openapi !== undefined) {
		const version = textOf(openapi) ?? "";
		if (/^3\.[01](\.|$)/.test(version)) return "openapi";
		throw new RequestImportFailure("UNSUPPORTED_VERSION", {
			version: `OpenAPI ${version}`.slice(0, 200),
		});
	}
	const swagger = prop(value, "swagger");
	if (swagger !== undefined) {
		throw new RequestImportFailure("UNSUPPORTED_VERSION", {
			version: `Swagger ${textOf(swagger) ?? ""}`.slice(0, 200),
		});
	}
	const schema = textOf(prop(recordProp(value, "info"), "schema"));
	if (schema !== null) {
		if (COLLECTION_V2_SCHEMA_PATTERN.test(schema)) return "collection-v21";
		throw new RequestImportFailure("UNSUPPORTED_VERSION", {
			version: schema.slice(0, 200),
		});
	}
	if (
		Array.isArray(prop(value, "requests")) &&
		Array.isArray(prop(value, "order"))
	) {
		throw new RequestImportFailure("UNSUPPORTED_VERSION", {
			version: "Collection v1",
		});
	}
	if (
		Array.isArray(prop(value, "values")) &&
		textOf(prop(value, "name")) !== null
	) {
		return listProp(value, "values").every(isRecord)
			? "environment-v21"
			: invalid();
	}
	throw new RequestImportFailure("UNKNOWN_FORMAT");
}

function invalid(): never {
	throw new RequestImportFailure("INVALID_DOCUMENT", { path: "values" });
}
