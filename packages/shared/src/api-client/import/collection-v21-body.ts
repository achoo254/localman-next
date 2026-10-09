/**
 * Body of a v2.1 request: raw (with its language), url-encoded, form-data
 * (file fields kept as empty file rows), GraphQL (sent as its JSON body)
 * and file (binary, the file is picked again).
 */
import type {
	FormDataRow,
	KeyValueRow,
	RawLanguage,
	RequestBody,
} from "../request-model.js";
import { RAW_LANGUAGES, emptyRequestBody } from "../request-model.js";
import {
	keyedItems,
	readRow,
	readRows,
	urlPart,
} from "./collection-v21-parts.js";
import { rawLanguageForType } from "./content-types.js";
import type { ImportContext } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	isRecord,
	listProp,
	prop,
	recordProp,
	textProp,
} from "./import-json.js";

function rawLanguage(
	body: unknown,
	headers: readonly KeyValueRow[],
): RawLanguage {
	const declared = textProp(
		prop(recordProp(body, "options"), "raw"),
		"language",
	);
	const known = RAW_LANGUAGES.find((language) => language === declared);
	if (known) return known;
	const type = headers.find(
		(h) => h.enabled && h.key.toLowerCase() === "content-type",
	);
	return type ? rawLanguageForType(type.value) : "text";
}

function formRows(
	list: readonly unknown[],
	ctx: ImportContext,
	path: string,
): FormDataRow[] {
	return keyedItems(list).map((field) => {
		const row = readRow(field, ctx);
		if (textProp(field, "type") !== "file") return { ...row, kind: "text" };
		const src = urlPart(prop(field, "src"), ", ");
		ctx.warn("FILE_NOT_INCLUDED", path, { name: paramText(src || row.key) });
		return { ...row, value: "", kind: "file" };
	});
}

/** GraphQL mode: what goes on the wire, `{ query, variables }` as JSON. */
function graphqlJson(value: unknown): string {
	const graphql = recordProp(value, "graphql");
	const variables = textProp(graphql, "variables").trim();
	let parsed: unknown;
	try {
		parsed = variables ? JSON.parse(variables) : undefined;
	} catch {
		parsed = undefined;
	}
	return JSON.stringify({
		query: textProp(graphql, "query"),
		variables: parsed,
	});
}

export function readBody(
	value: unknown,
	headers: readonly KeyValueRow[],
	ctx: ImportContext,
	path: string,
): RequestBody {
	const body = emptyRequestBody();
	if (!isRecord(value) || prop(value, "disabled") === true) return body;
	const mode = textProp(value, "mode", "raw");
	switch (mode) {
		case "raw":
			return {
				...body,
				type: "raw",
				raw: textProp(value, "raw"),
				rawLanguage: rawLanguage(value, headers),
			};
		case "urlencoded":
			return {
				...body,
				type: "urlencoded",
				urlencoded: readRows(listProp(value, "urlencoded"), ctx),
			};
		case "formdata":
			return {
				...body,
				type: "formdata",
				formData: formRows(listProp(value, "formdata"), ctx, path),
			};
		case "graphql":
			return {
				...body,
				type: "raw",
				rawLanguage: "json",
				raw: graphqlJson(value),
			};
		case "file": {
			const src = textProp(recordProp(value, "file"), "src");
			ctx.warn("FILE_NOT_INCLUDED", path, { name: paramText(src) });
			return { ...body, type: "binary" };
		}
		default:
			ctx.warn("UNSUPPORTED_BODY", path, { mode: paramText(mode) });
			return body;
	}
}
