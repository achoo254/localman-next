/**
 * Saved responses of a v2.1 request (`response[]`) as examples: name, the
 * request as sent (`originalRequest`, read like any request; the item's
 * own request when absent), status code and text, headers with disabled
 * rows, body and its language (`_postman_previewlanguage`). Cookies and
 * timings are not kept. Each example counts toward `MAX_IMPORT_ITEMS`.
 * Names, bodies and headers are fitted to the limits by `fit-tree.ts`.
 */
import type { ExampleResponse } from "../collections/collection-model.js";
import { RAW_LANGUAGES, type RawLanguage } from "../request-model.js";
import { clampDraft } from "./clamp-draft.js";
import { readHeaders } from "./collection-v21-parts.js";
import { readRequestDraft } from "./collection-v21-request.js";
import { rawLanguageForType } from "./content-types.js";
import { type ImportContext, joinPath } from "./import-context.js";
import { isRecord, prop, textProp } from "./import-json.js";
import type { ImportedExample } from "./imported-collection.js";

/** HTTP status of the example; 200 when missing or out of range. */
function readCode(value: unknown): number {
	const valid =
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 100 &&
		value <= 599;
	return valid ? value : 200;
}

function bodyLanguage(
	entry: unknown,
	headers: ExampleResponse["headers"],
): RawLanguage {
	const declared = textProp(entry, "_postman_previewlanguage").toLowerCase();
	const known = RAW_LANGUAGES.find((language) => language === declared);
	if (known) return known;
	const type = headers.find((h) => h.key.toLowerCase() === "content-type");
	return type ? rawLanguageForType(type.value) : "text";
}

function readResponse(entry: unknown, ctx: ImportContext): ExampleResponse {
	const headers = readHeaders(prop(entry, "header"), ctx);
	return {
		status: readCode(prop(entry, "code")),
		statusText: textProp(entry, "status"),
		headers,
		body: textProp(entry, "body"),
		bodyLanguage: bodyLanguage(entry, headers),
	};
}

/** `request` is the item's own request, used when an example has none. */
export function readExamples(
	list: readonly unknown[],
	request: unknown,
	ctx: ImportContext,
	path: string,
): ImportedExample[] {
	const out: ImportedExample[] = [];
	for (const entry of list) {
		if (!isRecord(entry)) continue;
		const name = textProp(entry, "name");
		const examplePath = joinPath(path, name);
		if (!ctx.takeItem(examplePath)) break;
		const original = prop(entry, "originalRequest") ?? request;
		const draft = readRequestDraft(original, name, ctx, examplePath);
		out.push({
			id: ctx.newId(),
			name,
			request: clampDraft(draft, ctx, examplePath),
			response: readResponse(entry, ctx),
		});
	}
	return out;
}
