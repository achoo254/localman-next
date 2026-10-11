/**
 * Body of a v2.1 request: raw (with its language), url-encoded, form-data
 * (file fields kept as empty file rows), GraphQL (sent as its JSON body)
 * and file (binary, the file is picked again: only its name is in the
 * file, and it is not kept).
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

/**
 * Language of the raw text: the declared one; for a raw body that is sent
 * and declares none, guessed from the Content-Type header, else `text`;
 * otherwise the editor default (`json`), which the exporter leaves out.
 */
function rawLanguage(
	body: unknown,
	headers: readonly KeyValueRow[],
	guess: boolean,
): RawLanguage {
	const declared = textProp(
		prop(recordProp(body, "options"), "raw"),
		"language",
	);
	const known = RAW_LANGUAGES.find((language) => language === declared);
	if (known) return known;
	if (!guess) return emptyRequestBody().rawLanguage;
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

/**
 * Every kind the body holds is read, not only the one `mode` sends, so a
 * Localman export (which keeps the others) comes back whole. `disabled`
 * or an unknown mode: nothing is sent (`none`), the content is kept.
 */
export function readBody(
	value: unknown,
	headers: readonly KeyValueRow[],
	ctx: ImportContext,
	path: string,
): RequestBody {
	if (!isRecord(value)) return emptyRequestBody();
	const mode = textProp(value, "mode", "raw");
	const disabled = prop(value, "disabled") === true;
	const body: RequestBody = {
		...emptyRequestBody(),
		raw: textProp(value, "raw"),
		rawLanguage: rawLanguage(value, headers, mode === "raw" && !disabled),
		urlencoded: readRows(listProp(value, "urlencoded"), ctx),
		formData: formRows(listProp(value, "formdata"), ctx, path),
	};
	if (disabled) return body;
	switch (mode) {
		case "raw":
			return { ...body, type: "raw" };
		case "urlencoded":
			return { ...body, type: "urlencoded" };
		case "formdata":
			return { ...body, type: "formdata" };
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
