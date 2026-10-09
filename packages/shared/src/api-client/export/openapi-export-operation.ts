/**
 * One request as an OpenAPI 3.0 operation: path, query and header
 * parameters with the typed values as examples, the body as a request
 * body with an example, and the effective auth as a security scheme.
 */
import type { JsonObject, JsonValue } from "../../json-value.js";
import {
	IMPLIED_CONTENT_TYPES,
	MULTIPART_TYPE,
	URLENCODED_TYPE,
	mediaTypeOf,
} from "../import/content-types.js";
import type {
	ApiRequestDraft,
	EffectiveAuth,
	KeyValueRow,
	RequestBody,
} from "../request-model.js";

/** Headers OpenAPI describes elsewhere (body media type, security). */
const SKIPPED_HEADERS = new Set(["content-type", "authorization", "accept"]);

export interface SecurityScheme {
	name: string;
	scheme: JsonObject;
}

/** Component name and definition of an auth; `null` for none. */
export function securityScheme(auth: EffectiveAuth): SecurityScheme | null {
	switch (auth.type) {
		case "none":
			return null;
		case "bearer":
			return { name: "bearerAuth", scheme: { type: "http", scheme: "bearer" } };
		case "basic":
			return { name: "basicAuth", scheme: { type: "http", scheme: "basic" } };
		case "apikey": {
			const safe = auth.key.replace(/[^A-Za-z0-9._-]/g, "_");
			return {
				name: `apiKey_${auth.in}_${safe}`,
				scheme: { type: "apiKey", in: auth.in, name: auth.key },
			};
		}
	}
}

function parameter(row: KeyValueRow, where: "query" | "header"): JsonObject {
	const out: JsonObject = {
		name: row.key,
		in: where,
		required: false,
		schema: { type: "string" },
		example: row.value,
	};
	if (row.description) out.description = row.description;
	return out;
}

/** `{name}` parameters of a templated path. */
export function pathParameters(path: string): JsonObject[] {
	return [...path.matchAll(/\{([^{}/]+)\}/g)].map((match) => ({
		name: match[1],
		in: "path",
		required: true,
		schema: { type: "string" },
	}));
}

function fieldsSchema(
	rows: readonly { key: string; file: boolean; value: string }[],
): JsonObject {
	const properties = rows.map((row): [string, JsonValue] => {
		const schema: JsonObject = row.file
			? { type: "string", format: "binary" }
			: { type: "string", example: row.value };
		return [row.key, schema];
	});
	return { type: "object", properties: Object.fromEntries(properties) };
}

function jsonExample(raw: string): JsonValue {
	try {
		const parsed: JsonValue = JSON.parse(raw);
		return parsed;
	} catch {
		return raw;
	}
}

/** Request body object, keyed by the user's Content-Type when set. */
function requestBody(
	body: RequestBody,
	contentType: string | null,
): JsonObject | null {
	const enabled = <T extends KeyValueRow>(rows: readonly T[]): T[] =>
		rows.filter((row) => row.enabled && row.key.trim());
	let type: string;
	let media: JsonObject;
	switch (body.type) {
		case "none":
			return null;
		case "raw":
			if (!body.raw.trim()) return null;
			type = contentType ?? IMPLIED_CONTENT_TYPES[body.rawLanguage];
			media =
				body.rawLanguage === "json"
					? { example: jsonExample(body.raw) }
					: { schema: { type: "string" }, example: body.raw };
			break;
		case "urlencoded":
			type = URLENCODED_TYPE;
			media = {
				schema: fieldsSchema(
					enabled(body.urlencoded).map((r) => ({
						key: r.key,
						value: r.value,
						file: false,
					})),
				),
			};
			break;
		case "formdata":
			type = MULTIPART_TYPE;
			media = {
				schema: fieldsSchema(
					enabled(body.formData).map((r) => ({
						key: r.key,
						value: r.value,
						file: r.kind === "file",
					})),
				),
			};
			break;
		case "binary":
			type =
				contentType ?? body.binary?.contentType ?? "application/octet-stream";
			media = { schema: { type: "string", format: "binary" } };
			break;
	}
	return { content: { [type]: media } };
}

/** The operation; `path` is already templated (`/users/{id}`). */
export function operationFor(
	name: string,
	description: string,
	draft: ApiRequestDraft,
	path: string,
	tag: string | null,
	security: SecurityScheme | null,
): JsonObject {
	const headers = draft.headers.filter(
		(row) =>
			row.enabled &&
			row.key.trim() &&
			!SKIPPED_HEADERS.has(row.key.trim().toLowerCase()),
	);
	const contentType = draft.headers.find(
		(row) => row.enabled && row.key.trim().toLowerCase() === "content-type",
	);
	const parameters = [
		...pathParameters(path),
		...draft.params
			.filter((row) => row.key.trim())
			.map((row) => parameter(row, "query")),
		...headers.map((row) => parameter(row, "header")),
	];
	const operation: JsonObject = { summary: name || `${draft.method} ${path}` };
	if (description) operation.description = description;
	if (tag) operation.tags = [tag];
	if (parameters.length > 0) operation.parameters = parameters;
	const sendsBody = draft.method !== "GET" && draft.method !== "HEAD";
	const type = contentType ? mediaTypeOf(contentType.value) : null;
	const body = sendsBody ? requestBody(draft.body, type) : null;
	if (body) operation.requestBody = body;
	operation.responses = { "200": { description: "OK" } };
	operation.security = security ? [{ [security.name]: [] }] : [];
	return operation;
}
