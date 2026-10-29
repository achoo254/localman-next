import {
	MAX_INFERENCE_BYTES,
	RESOURCE_NAME_MAX,
} from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import { isRecord } from "../../lib/json-guards";
import { parseJsonText } from "../../lib/json-text";
import { resourceNameError } from "./resource-form-validation";
import type {
	ImportFormat,
	ImportRequest,
	ImportedResource,
} from "./resource-import-api";

export type ImportTab = "json" | "openapi" | "file";

/** A chosen CSV or JSON file, read as text. */
export interface ImportFile {
	name: string;
	size: number;
	text: string;
	format: Extract<ImportFormat, "json" | "csv">;
}

/** Source of one tab: a request to preview, nothing yet, or why it can't be read. */
export type SourceCheck =
	| { kind: "empty" }
	| { kind: "error"; message: string }
	| { kind: "ready"; request: ImportRequest };

const EMPTY: SourceCheck = { kind: "empty" };

export const utf8Bytes = (text: string): number =>
	new TextEncoder().encode(text).length;

/** KB with one decimal at most, for "48 KB"; a tiny file shows 0.1, not 0. */
export const kilobytes = (bytes: number): number =>
	Math.max(0.1, Math.round((bytes / 1024) * 10) / 10);

/** Format of a file by its extension; `null` for anything but CSV or JSON. */
export function fileFormat(name: string): ImportFile["format"] | null {
	const extension = name.toLowerCase().split(".").pop();
	if (extension === "csv") return "csv";
	return extension === "json" ? "json" : null;
}

/** `Users List.csv` → `users-list`: lower case, invalid characters as `-`. */
export function nameFromFile(fileName: string): string {
	return fileName
		.replace(/\.[^.]*$/, "")
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^[-_]+|-+$/g, "")
		.slice(0, RESOURCE_NAME_MAX);
}

/** A pasted sample: an object or a non-empty array of objects, at most 2 MB. */
export function checkSample(
	text: string,
	t: Translate,
	syntaxError: string | null,
): SourceCheck {
	if (text.trim() === "") return EMPTY;
	if (utf8Bytes(text) > MAX_INFERENCE_BYTES) {
		return {
			kind: "error",
			message: t("resourceImport.errors.pastedTooLarge"),
		};
	}
	const parsed = parseJsonText(text);
	// Half-typed JSON waits for the editor's blur check (line and column).
	if (!parsed.ok)
		return syntaxError ? { kind: "error", message: syntaxError } : EMPTY;
	const { value } = parsed;
	if (Array.isArray(value) && value.length === 0) {
		return { kind: "error", message: t("resourceImport.errors.jsonEmpty") };
	}
	const objects = Array.isArray(value)
		? value.every(isRecord)
		: isRecord(value);
	if (!objects) {
		return { kind: "error", message: t("resourceImport.errors.jsonShape") };
	}
	return { kind: "ready", request: { format: "json", input: text } };
}

export interface OpenApiChoice {
	schema: string | null;
	includeRelated: boolean;
}

/** An OpenAPI document as JSON text; the API checks the rest. */
export function checkOpenApi(
	text: string,
	choice: OpenApiChoice,
	t: Translate,
	syntaxError: string | null,
): SourceCheck {
	// The editor's blur check (with line and column), or a file that failed.
	if (syntaxError) return { kind: "error", message: syntaxError };
	if (text.trim() === "") return EMPTY;
	if (utf8Bytes(text) > MAX_INFERENCE_BYTES) {
		return { kind: "error", message: t("resourceImport.errors.inputTooLarge") };
	}
	if (!parseJsonText(text).ok) return EMPTY;
	return {
		kind: "ready",
		request: {
			format: "openapi",
			input: text,
			includeRelated: choice.includeRelated,
			...(choice.schema ? { schema: choice.schema } : {}),
		},
	};
}

/** A file already read; its name gives the resource name. */
export function checkFile(file: ImportFile | null): SourceCheck {
	if (!file) return EMPTY;
	const name = nameFromFile(file.name);
	return {
		kind: "ready",
		request: {
			format: file.format,
			input: file.text,
			...(name ? { name } : {}),
		},
	};
}

/**
 * Errors of the names the import will create, by resource `key`: the rules
 * of the resource form, root names unique among the project's roots, and
 * no name twice in the import.
 */
export function importNameErrors(
	resources: readonly ImportedResource[],
	names: Readonly<Record<string, string>>,
	rootNames: readonly string[],
	t: Translate,
): Record<string, string> {
	const errors: Record<string, string> = {};
	const seen = new Set<string>();
	for (const resource of resources) {
		const name = (names[resource.key] ?? resource.name).trim();
		const place = {
			parentKey: null,
			parentName: null,
			children: [],
			siblingNames: resource.parentName === null ? rootNames : [],
		};
		const error =
			resourceNameError(name, place, t) ??
			(seen.has(name) ? t("resourceImport.errors.nameDuplicate") : undefined);
		seen.add(name);
		if (error) errors[resource.key] = error;
	}
	return errors;
}

/**
 * The renames for the create call: the main resource through `name`
 * (which wins over `names` for it), the others through `names` by key.
 */
export function renamesOf(
	resources: readonly ImportedResource[],
	names: Readonly<Record<string, string>>,
): Pick<ImportRequest, "name" | "names"> {
	const [main, ...others] = resources;
	const edited = (resource: ImportedResource) =>
		(names[resource.key] ?? resource.name).trim();
	const renamed = others.filter(
		(resource) => edited(resource) !== resource.name,
	);
	return {
		...(main && edited(main) !== main.name ? { name: edited(main) } : {}),
		...(renamed.length > 0
			? { names: Object.fromEntries(renamed.map((r) => [r.key, edited(r)])) }
			: {}),
	};
}
