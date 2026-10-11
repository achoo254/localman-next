/**
 * A v2.1 `request` object as a draft: the request of an item, and the
 * `originalRequest` of a saved example. Item-level parts (scripts and
 * settings) are added by the caller. Absent auth means `inherit`.
 */
import {
	type ApiRequestDraft,
	HTTP_METHODS,
	type HttpMethod,
	createRequestDraft,
} from "../request-model.js";
import { readBody } from "./collection-v21-body.js";
import {
	readAuth,
	readHeaders,
	readParams,
	readUrl,
} from "./collection-v21-parts.js";
import type { ImportContext } from "./import-context.js";
import { paramText } from "./import-error.js";
import { prop, textProp } from "./import-json.js";

function readMethod(
	request: unknown,
	ctx: ImportContext,
	path: string,
): HttpMethod {
	const text = textProp(request, "method", "GET").toUpperCase();
	const known = HTTP_METHODS.find((method) => method === text);
	if (known) return known;
	ctx.warn("UNSUPPORTED_METHOD", path, { method: paramText(text) });
	return "GET";
}

/** `request` may also be a bare URL string (v2.1 allows it). */
export function readRequestDraft(
	request: unknown,
	name: string,
	ctx: ImportContext,
	path: string,
): ApiRequestDraft {
	const urlValue = typeof request === "string" ? request : prop(request, "url");
	const url = readUrl(urlValue);
	const headers = readHeaders(prop(request, "header"), ctx);
	return createRequestDraft({
		name: name || url,
		method: readMethod(request, ctx, path),
		url,
		params: readParams(urlValue, url, ctx),
		headers,
		auth: readAuth(prop(request, "auth"), ctx, path) ?? { type: "inherit" },
		body: readBody(prop(request, "body"), headers, ctx, path),
	});
}
