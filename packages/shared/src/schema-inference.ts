/**
 * Resources (schema, parent and seed records) inferred from a JSON sample,
 * an OpenAPI 3.x document or a CSV file, for the resource import of the
 * web app and MCP. Pure and bounded: input up to 2 MB, JSON depth and
 * node caps, at most `MAX_INFERRED_RESOURCES` resources, the schema rules
 * of `FieldCollector` (field names, `MAX_SCHEMA_FIELDS`, forbidden keys).
 * OpenAPI goes through `schemaFromOpenApi`; `$ref` is never fetched.
 * Errors are returned as `{ ok: false }`, never thrown.
 */
import {
	type JsonLimits,
	type JsonObject,
	type JsonValue,
	checkJson,
	isJsonObject,
	jsonSize,
	utf8Length,
} from "./json-value.js";
import { readOpenApiInput } from "./openapi-document.js";
import {
	type ImportParams,
	type SchemaImportError,
	SchemaImportFailure,
	type SchemaImportWarning,
	importFailure,
} from "./schema-import-errors.js";
import {
	DEFAULT_INFERRED_NAME,
	InferenceContext,
	type InferredResource,
} from "./schema-inference-context.js";
import { inferFromCsv } from "./schema-inference-csv.js";
import { inferFromSample } from "./schema-inference-json.js";
import { inferFromOpenApi } from "./schema-inference-openapi.js";

export {
	DEFAULT_INFERRED_NAME,
	type InferredResource,
	MAX_INFERRED_RESOURCES,
	normalizeResourceName,
} from "./schema-inference-context.js";

export const MAX_INFERENCE_BYTES = 2 * 1024 * 1024;
/** Like the OpenAPI importer: deep enough for real data, bounded work. */
const SAMPLE_LIMITS: JsonLimits = { maxDepth: 64, maxNodes: 200_000 };

/** `auto` reads OpenAPI or a JSON sample from JSON, and CSV otherwise. */
export type InferenceFormat = "auto" | "json" | "openapi" | "csv";

export interface SchemaInferenceOptions {
	readonly format?: InferenceFormat;
	/** Name of the root resource of a JSON sample or CSV (`items`). */
	readonly name?: string;
}

export type SchemaInferenceResult =
	| {
			readonly ok: true;
			/** Parents come before their children. */
			readonly resources: readonly InferredResource[];
			readonly warnings: readonly SchemaImportWarning[];
	  }
	| { readonly ok: false; readonly error: SchemaImportError };

const fail = (
	code: SchemaImportError["code"],
	message: string,
	params: ImportParams = {},
): SchemaImportFailure => new SchemaImportFailure(code, message, params);
const tooLarge = (): SchemaImportFailure =>
	fail("INPUT_TOO_LARGE", "The input is larger than 2 MB", {
		max: MAX_INFERENCE_BYTES,
	});

const withoutBom = (text: string): string =>
	text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

const looksLikeJson = (text: string): boolean =>
	/^\s*[[{]/.test(withoutBom(text));

const isOpenApi = (value: JsonValue): value is JsonObject =>
	isJsonObject(value) &&
	(Object.hasOwn(value, "openapi") || Object.hasOwn(value, "swagger"));

/** JSON text or an already parsed value, checked against the caps. */
function readJson(input: unknown): JsonValue {
	let value = input;
	if (typeof input === "string") {
		try {
			value = JSON.parse(withoutBom(input));
		} catch {
			throw fail("INVALID_INPUT", "The input is not valid JSON");
		}
	}
	const checked = checkJson(value, SAMPLE_LIMITS);
	if (!checked.ok) {
		const [problem] = checked.problems;
		const where = problem?.path ? ` at ${problem.path}` : "";
		throw fail(
			"INVALID_INPUT",
			`${problem?.message ?? "Invalid JSON"}${where}`,
		);
	}
	if (jsonSize(checked.value).bytes > MAX_INFERENCE_BYTES) {
		throw tooLarge();
	}
	return checked.value;
}

/** Resources inferred from `input`, or the reason it cannot be read. */
export function inferSchema(
	input: unknown,
	options: SchemaInferenceOptions = {},
): SchemaInferenceResult {
	try {
		if (
			typeof input === "string" &&
			(input.length > MAX_INFERENCE_BYTES ||
				utf8Length(input) > MAX_INFERENCE_BYTES)
		) {
			throw tooLarge();
		}
		const ctx = new InferenceContext();
		const rootName = options.name ?? DEFAULT_INFERRED_NAME;
		const format = options.format ?? "auto";
		const isText = typeof input === "string";
		if (
			format === "csv" ||
			(format === "auto" && isText && !looksLikeJson(input))
		) {
			if (typeof input !== "string")
				throw fail("INVALID_INPUT", "CSV input must be text");
			inferFromCsv(ctx, input, rootName);
		} else if (format === "openapi") {
			const text = typeof input === "string" ? withoutBom(input) : input;
			inferFromOpenApi(ctx, readOpenApiInput(text), rootName);
		} else {
			const value = readJson(input);
			if (format === "auto" && isOpenApi(value)) {
				// Checked by readJson against the same caps as readOpenApiInput.
				inferFromOpenApi(ctx, value, rootName);
			} else {
				inferFromSample(ctx, value, rootName);
			}
		}
		return ctx.finish();
	} catch (error) {
		return importFailure(error);
	}
}
