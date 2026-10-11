import { clampDraft } from "./clamp-draft.js";
/**
 * Items of a v2.1 collection: folders (with their own auth and scripts)
 * and requests, in file order. A request without auth inherits; a folder
 * without auth passes its parent's on. Saved responses (`response[]`)
 * become the request's examples.
 */
import { readExamples } from "./collection-v21-examples.js";
import { readSettings } from "./collection-v21-extension.js";
import { readAuth, readScripts } from "./collection-v21-parts.js";
import { readRequestDraft } from "./collection-v21-request.js";
import { type ImportContext, joinPath } from "./import-context.js";
import {
	descriptionOf,
	isRecord,
	listProp,
	prop,
	textProp,
} from "./import-json.js";
import type { ImportedItem, ImportedRequest } from "./imported-collection.js";

function readRequestItem(
	item: unknown,
	name: string,
	ctx: ImportContext,
	path: string,
): ImportedRequest {
	const request = prop(item, "request");
	const draft = clampDraft(
		{
			...readRequestDraft(request, name, ctx, path),
			scripts: readScripts(listProp(item, "event"), ctx, path),
			settings: readSettings(item),
		},
		ctx,
		path,
	);
	return {
		kind: "request",
		id: ctx.newId(),
		name: draft.name,
		description:
			descriptionOf(prop(request, "description")) ||
			descriptionOf(prop(item, "description")),
		draft,
		examples: readExamples(listProp(item, "response"), request, ctx, path),
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
