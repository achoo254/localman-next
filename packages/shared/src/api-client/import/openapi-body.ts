/**
 * Request body of an OpenAPI operation: the first JSON media type (else
 * url-encoded, multipart, the first one listed), filled with the media
 * example or one generated from its schema.
 */
import {
	type FormDataRow,
	type KeyValueRow,
	type RawLanguage,
	type RequestBody,
	emptyRequestBody,
} from "../request-model.js";
import {
	IMPLIED_CONTENT_TYPES,
	isExactType,
	rawLanguageForType,
} from "./content-types.js";
import type { ImportContext } from "./import-context.js";
import {
	type JsonRecord,
	isRecord,
	keysOf,
	prop,
	recordProp,
	textOf,
} from "./import-json.js";
import {
	derefLocal,
	exampleFromSchema,
	exampleText,
} from "./openapi-example.js";

export interface OpenApiBody {
	body: RequestBody;
	/** Set when the media type differs from what the body type implies. */
	contentType: string | null;
}

const JSON_TYPE = /^application\/(.+\+)?json\b/i;

function pickMediaType(content: JsonRecord): string | undefined {
	const types = keysOf(content);
	return (
		types.find((t) => JSON_TYPE.test(t)) ??
		types.find((t) => /^application\/x-www-form-urlencoded/i.test(t)) ??
		types.find((t) => /^multipart\/form-data/i.test(t)) ??
		types[0]
	);
}

/** `example`, the first of `examples`, or one built from `schema`. */
function mediaExample(
	root: JsonRecord,
	media: unknown,
	ctx: ImportContext,
	path: string,
): unknown {
	const example = prop(media, "example");
	if (example !== undefined) return example;
	const examples = recordProp(media, "examples");
	const first = keysOf(examples)[0];
	if (first !== undefined) {
		const named = derefLocal(root, prop(examples, first), ctx, path);
		const value = prop(named, "value");
		if (value !== undefined) return value;
	}
	return exampleFromSchema(root, prop(media, "schema"), ctx, path);
}

/** Properties of the media schema as rows (file fields for binary ones). */
function fieldRows(
	root: JsonRecord,
	media: unknown,
	ctx: ImportContext,
	path: string,
): FormDataRow[] {
	const example = mediaExample(root, media, ctx, path);
	const schema = derefLocal(root, prop(media, "schema"), ctx, path);
	const properties = recordProp(schema, "properties");
	return keysOf(isRecord(example) ? example : properties).map((key) => {
		const field = derefLocal(root, prop(properties, key), ctx, path);
		const format = textOf(prop(field, "format"));
		const isFile = format === "binary" || format === "base64";
		const value = isRecord(example) ? exampleText(prop(example, key)) : "";
		return {
			id: ctx.newId(),
			key,
			value: isFile ? "" : value,
			enabled: true,
			kind: isFile ? "file" : "text",
		};
	});
}

export function readRequestBody(
	root: JsonRecord,
	requestBody: unknown,
	ctx: ImportContext,
	path: string,
): OpenApiBody {
	const empty: OpenApiBody = { body: emptyRequestBody(), contentType: null };
	const content = recordProp(
		derefLocal(root, requestBody, ctx, path),
		"content",
	);
	const type = content === null ? undefined : pickMediaType(content);
	if (content === null || type === undefined) return empty;
	const media = prop(content, type);
	const body = emptyRequestBody();
	if (/^application\/x-www-form-urlencoded/i.test(type)) {
		const urlencoded: KeyValueRow[] = fieldRows(root, media, ctx, path).map(
			({ kind: _kind, ...row }) => row,
		);
		return {
			body: { ...body, type: "urlencoded", urlencoded },
			contentType: null,
		};
	}
	if (/^multipart\/form-data/i.test(type)) {
		const formData = fieldRows(root, media, ctx, path);
		return { body: { ...body, type: "formdata", formData }, contentType: null };
	}
	if (/^(application\/octet-stream|image\/|audio\/|video\/)/i.test(type)) {
		return { body: { ...body, type: "binary" }, contentType: null };
	}
	const rawLanguage = rawLanguageForType(type);
	const example = mediaExample(root, media, ctx, path);
	const raw =
		rawLanguage === "json"
			? example === undefined || example === null
				? ""
				: JSON.stringify(example, null, 2)
			: (textOf(example) ?? "");
	const implied = isExactType(type, IMPLIED_CONTENT_TYPES[rawLanguage]);
	return {
		body: { ...body, type: "raw", rawLanguage, raw },
		contentType: implied ? null : type,
	};
}
