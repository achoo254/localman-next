/**
 * Items of a v2.1 collection: folders (with their own auth and scripts)
 * and requests, in file order. A request without auth inherits; a folder
 * without auth passes its parent's on.
 */
import {
	HTTP_METHODS,
	type HttpMethod,
	createRequestDraft,
} from "../request-model.js";
import { readBody } from "./collection-v21-body.js";
import {
	readAuth,
	readHeaders,
	readParams,
	readScripts,
	readUrl,
} from "./collection-v21-parts.js";
import { type ImportContext, clampDraft, joinPath } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	descriptionOf,
	isRecord,
	listProp,
	prop,
	recordProp,
	textProp,
} from "./import-json.js";
import type { ImportedItem, ImportedRequest } from "./imported-collection.js";

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

function readRequestItem(
	item: unknown,
	name: string,
	ctx: ImportContext,
	path: string,
): ImportedRequest {
	const request = prop(item, "request");
	const urlValue = typeof request === "string" ? request : prop(request, "url");
	const url = readUrl(urlValue);
	const headers = readHeaders(prop(request, "header"), ctx);
	const draft = createRequestDraft({
		name: name || url,
		method: readMethod(request, ctx, path),
		url,
		params: readParams(urlValue, url, ctx),
		headers,
		auth: readAuth(prop(request, "auth"), ctx, path) ?? { type: "inherit" },
		body: readBody(prop(request, "body"), headers, ctx, path),
		scripts: readScripts(listProp(item, "event"), ctx, path),
	});
	const behavior = recordProp(item, "protocolProfileBehavior");
	if (prop(behavior, "followRedirects") === false) {
		draft.settings.followRedirects = false;
	}
	return {
		kind: "request",
		id: ctx.newId(),
		name: draft.name,
		description: descriptionOf(prop(request, "description")),
		draft: clampDraft(draft, ctx, path),
	};
}

/** Folders and requests of `list`; stops at `MAX_IMPORT_ITEMS`. */
export function readItems(
	list: readonly unknown[],
	ctx: ImportContext,
	parentPath: string,
): ImportedItem[] {
	const out: ImportedItem[] = [];
	for (const item of list) {
		if (!isRecord(item)) continue;
		const name = textProp(item, "name");
		const path = joinPath(parentPath, name);
		const children = prop(item, "item");
		const hasRequest = prop(item, "request") !== undefined;
		const isFolder = Array.isArray(children) && !hasRequest;
		if (!isFolder && !hasRequest) continue;
		if (!ctx.takeItem(path)) break;
		if (!isFolder) {
			out.push(readRequestItem(item, name, ctx, path));
			continue;
		}
		out.push({
			kind: "folder",
			id: ctx.newId(),
			name,
			description: descriptionOf(prop(item, "description")),
			auth: readAuth(prop(item, "auth"), ctx, path) ?? { type: "inherit" },
			scripts: readScripts(listProp(item, "event"), ctx, path),
			items: readItems(children, ctx, path),
		});
	}
	return out;
}
