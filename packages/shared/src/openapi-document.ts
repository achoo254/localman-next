/**
 * Reading an OpenAPI 3.x document (or a bare Schema / JSON Schema) for
 * `schema-from-openapi.ts`: size and shape checks, local `$ref`
 * resolution with cycle detection, and choosing the schema to import.
 * JSON only; `$ref` outside the document is refused, never fetched.
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
import {
	componentName,
	deref,
	failure,
	objectAt,
	quote,
} from "./openapi-ref.js";
import { paramText } from "./schema-import-errors.js";

export const MAX_OPENAPI_BYTES = 2 * 1024 * 1024;
const DOCUMENT_LIMITS: JsonLimits = { maxDepth: 64, maxNodes: 200_000 };
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export interface OpenApiImportOptions {
	/** Name in `components.schemas`. */
	readonly schema?: string;
	/** Key of `paths`: its first operation's JSON body schema is used. */
	readonly path?: string;
}

export interface OpenApiSchemaChoice {
	readonly name: string | null;
	readonly schema: JsonValue;
}

/** The input as a checked JSON object: a JSON string or a parsed value. */
export function readOpenApiInput(input: unknown): JsonObject {
	let value = input;
	if (typeof input === "string") {
		if (utf8Length(input) > MAX_OPENAPI_BYTES) {
			throw failure("INPUT_TOO_LARGE", "OpenAPI input is larger than 2 MB", {
				max: MAX_OPENAPI_BYTES,
			});
		}
		if (!/^\s*\{/.test(input)) {
			throw failure(
				"UNSUPPORTED",
				"Expected a JSON object (YAML is not supported)",
			);
		}
		try {
			value = JSON.parse(input);
		} catch {
			throw failure("INVALID_INPUT", "The OpenAPI input is not valid JSON");
		}
	}
	const checked = checkJson(value, DOCUMENT_LIMITS);
	if (!checked.ok) {
		const [problem] = checked.problems;
		const where = problem?.path ? ` at ${problem.path}` : "";
		throw failure("INVALID_INPUT", `${problem?.message ?? "Invalid"}${where}`);
	}
	if (!isJsonObject(checked.value)) {
		throw failure("INVALID_INPUT", "Expected an OpenAPI document or schema");
	}
	if (jsonSize(checked.value).bytes > MAX_OPENAPI_BYTES) {
		throw failure("INPUT_TOO_LARGE", "OpenAPI input is larger than 2 MB", {
			max: MAX_OPENAPI_BYTES,
		});
	}
	return checked.value;
}

/** Names of `components.schemas`, in document order. */
export function openApiSchemaNames(root: JsonObject): string[] {
	return Object.keys(objectAt(objectAt(root, "components"), "schemas") ?? {});
}

/** JSON schema of a request body or response, following `$ref`. */
function bodySchema(
	root: JsonObject,
	body: JsonValue | undefined,
): JsonValue | null {
	if (body === undefined) return null;
	const content = objectAt(deref(root, body).value, "content") ?? {};
	const type =
		Object.keys(content).find((key) =>
			/^application\/(.+\+)?json\b/.test(key),
		) ?? Object.keys(content)[0];
	const media = type === undefined ? null : objectAt(content, type);
	return media?.schema ?? null;
}

function pathSchema(
	root: JsonObject,
	path: string,
): OpenApiSchemaChoice | null {
	const item = objectAt(objectAt(root, "paths"), path);
	for (const method of METHODS) {
		const operation = objectAt(item ?? undefined, method);
		if (operation === null) continue;
		const responses = objectAt(operation, "responses") ?? {};
		const codes = Object.keys(responses).filter((code) => /^2/.test(code));
		const schema =
			[...codes, "default"]
				.map((code) => bodySchema(root, responses[code]))
				.find((found) => found !== null) ??
			bodySchema(root, operation.requestBody);
		if (schema === null) continue;
		const { value, ref } = deref(root, schema);
		const items = objectAt(value, "items") ?? {};
		const segments = path
			.split("/")
			.filter((s) => s !== "" && !s.startsWith("{"));
		const name =
			componentName(ref) ??
			componentName(deref(root, items).ref) ??
			segments.pop() ??
			null;
		return { name, schema };
	}
	return null;
}

/** The schema `options` names, or the first component, or the first path. */
export function chooseSchema(
	root: JsonObject,
	options: OpenApiImportOptions,
): OpenApiSchemaChoice {
	if (root.swagger !== undefined) {
		throw failure("UNSUPPORTED", "Swagger 2.0 is not supported; use OpenAPI 3");
	}
	const version = root.openapi;
	if (version !== undefined && !/^3\./.test(String(version))) {
		throw failure(
			"UNSUPPORTED",
			`OpenAPI ${quote(String(version))} is not 3.x`,
		);
	}
	const isDocument = ["openapi", "paths", "components"].some((key) =>
		Object.hasOwn(root, key),
	);
	if (!isDocument) {
		const title = typeof root.title === "string" ? root.title : null;
		return { name: options.schema ?? title, schema: root };
	}
	const schemas = objectAt(objectAt(root, "components"), "schemas");
	const wanted =
		options.schema ??
		(options.path === undefined ? openApiSchemaNames(root)[0] : undefined);
	if (wanted !== undefined) {
		const schema =
			schemas !== null && Object.hasOwn(schemas, wanted)
				? schemas[wanted]
				: undefined;
		if (schema !== undefined) return { name: wanted, schema };
		throw failure("SCHEMA_NOT_FOUND", `No schema named ${quote(wanted)}`, {
			name: paramText(wanted),
		});
	}
	const paths =
		options.path === undefined
			? Object.keys(objectAt(root, "paths") ?? {})
			: [options.path];
	for (const path of paths) {
		const choice = pathSchema(root, path);
		if (choice !== null) return choice;
	}
	throw failure(
		"SCHEMA_NOT_FOUND",
		options.path === undefined
			? "The document has no schema"
			: `No JSON schema for path ${quote(options.path)}`,
	);
}
