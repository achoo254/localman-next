import { FIELD_TYPES, type FieldType } from "@localman/shared/constants";
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";
import { resourcesPath } from "./resources-api";

export type ImportFormat = "json" | "openapi" | "csv";

/** Body of the import, preview (dry run) and create alike. */
export interface ImportRequest {
	format: ImportFormat;
	/** The source text (5 MB at most). */
	input: string;
	/** Name of the main (first) resource. */
	name?: string;
	/** OpenAPI: the `components.schemas` entry to import. */
	schema?: string;
	/** OpenAPI: also create the schemas it references. */
	includeRelated?: boolean;
	/** New names of the other resources, by their `key`. */
	names?: Record<string, string>;
}

export interface ImportedField {
	name: string;
	type: FieldType;
	fakerMethod: string | null;
	suggested: boolean;
}

export interface ImportedResource {
	/** Name the import inferred: the key to rename it with in `names`. */
	key: string;
	name: string;
	parentName: string | null;
	fields: ImportedField[];
	/** Up to 5 records: from the source, or generated (OpenAPI). */
	sample: JsonRecord[];
	sampleKind: "source" | "generated";
	recordCount: number;
	/** The source has more records than a resource may hold. */
	truncated: boolean;
}

export interface ImportWarning {
	code: string;
	path: string;
	params: JsonRecord;
	/** English fallback for codes this build does not know. */
	message: string;
}

export interface ImportPreview {
	/** The root resource first, parents before children. */
	resources: ImportedResource[];
	warnings: ImportWarning[];
	schemaNames: string[];
	selectedSchema: string | null;
	relatedCount: number;
	/** Resources the owner's plan still allows; `null` without a cap. */
	resourcesLeft: number | null;
}

function parseField(value: unknown): ImportedField {
	const data = expectRecord(value, "imported field");
	const type = FIELD_TYPES.find((item) => item === data.type);
	if (type === undefined) throw new InvalidResponseError("imported field type");
	return {
		name: expectString(data, "name"),
		type,
		fakerMethod: optionalString(data, "fakerMethod"),
		suggested: data.suggested === true,
	};
}

function parseResource(value: unknown): ImportedResource {
	const data = expectRecord(value, "imported resource");
	const name = expectString(data, "name");
	return {
		key: typeof data.key === "string" ? data.key : name,
		name,
		parentName: optionalString(data, "parentName"),
		fields: expectArray(data, "fields").map(parseField),
		sample: expectArray(data, "sample").filter(isRecord),
		sampleKind: data.sampleKind === "generated" ? "generated" : "source",
		recordCount: expectNumber(data, "recordCount"),
		truncated: data.truncated === true,
	};
}

function parseWarning(value: unknown): ImportWarning {
	const data = expectRecord(value, "import warning");
	return {
		code: typeof data.code === "string" ? data.code : "",
		path: typeof data.path === "string" ? data.path : "",
		params: isRecord(data.params) ? data.params : {},
		message: expectString(data, "message"),
	};
}

export function parseImportPreview(value: unknown): ImportPreview {
	const data = expectRecord(value, "import preview");
	const left = data.resourcesLeft;
	if (left !== null && typeof left !== "number") {
		throw new InvalidResponseError("resourcesLeft");
	}
	return {
		resources: expectArray(data, "resources").map(parseResource),
		warnings: expectArray(data, "warnings").map(parseWarning),
		schemaNames: Array.isArray(data.schemaNames)
			? data.schemaNames.filter((name) => typeof name === "string")
			: [],
		selectedSchema: optionalString(data, "selectedSchema"),
		relatedCount: typeof data.relatedCount === "number" ? data.relatedCount : 0,
		resourcesLeft: left,
	};
}

/** Preview (`dryRun`) or create the resources of an import, at the root. */
export async function importResources(
	projectId: string,
	request: ImportRequest,
	dryRun: boolean,
	signal?: AbortSignal,
): Promise<ImportPreview> {
	return parseImportPreview(
		await apiRequest(withDryRun(`${resourcesPath(projectId)}/import`, dryRun), {
			method: "POST",
			body: request,
			signal,
		}),
	);
}
