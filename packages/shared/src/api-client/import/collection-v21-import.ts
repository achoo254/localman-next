/**
 * A v2.1 (or v2.0) collection to an `ImportedCollection`: folders kept as
 * a tree, auth left as `inherit` where the file sets none, scripts and
 * collection variables kept. Read from untrusted JSON, own properties only.
 */
import type { EffectiveAuth } from "../request-model.js";
import { readCollectionExtension } from "./collection-v21-extension.js";
import { readItems } from "./collection-v21-items.js";
import { readAuth, readScripts } from "./collection-v21-parts.js";
import { readVariables } from "./environment-v21-import.js";
import type { ImportContext } from "./import-context.js";
import { RequestImportFailure } from "./import-error.js";
import {
	descriptionOf,
	listProp,
	prop,
	recordProp,
	textProp,
} from "./import-json.js";
import type { ImportedCollection } from "./imported-collection.js";

/** `value` has `info.schema` of v2.0 or v2.1 (checked by `detect-format.ts`). */
export function collectionV21ToTree(
	value: unknown,
	ctx: ImportContext,
): ImportedCollection {
	const info = recordProp(value, "info");
	if (!Array.isArray(prop(value, "item"))) {
		throw new RequestImportFailure("INVALID_DOCUMENT", { path: "item" });
	}
	const auth = readAuth(prop(value, "auth"), ctx, "");
	const collectionAuth: EffectiveAuth =
		auth === null || auth.type === "inherit" ? { type: "none" } : auth;
	const scripts = readScripts(listProp(value, "event"), ctx, "");
	const items = readItems(listProp(value, "item"), ctx, "");
	return {
		format: "collection-v21",
		name: textProp(info, "name"),
		description: descriptionOf(prop(info, "description")),
		auth: collectionAuth,
		variables: readVariables(listProp(value, "variable")),
		scripts,
		items,
		...readCollectionExtension(value, ctx),
		warnings: ctx.warnings(),
	};
}
