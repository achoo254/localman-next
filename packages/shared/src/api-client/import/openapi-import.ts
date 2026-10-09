/**
 * An OpenAPI 3.0 or 3.1 document (JSON) to an `ImportedCollection`: one
 * request per operation, grouped in folders by first tag, URLs built on a
 * `{{baseUrl}}` collection variable set to the first server. `$ref` is
 * followed inside the document only.
 */
import { HTTP_METHODS } from "../request-model.js";
import type { ImportContext } from "./import-context.js";
import { joinPath } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	type JsonRecord,
	descriptionOf,
	keysOf,
	listProp,
	prop,
	recordProp,
	textOf,
	textProp,
} from "./import-json.js";
import type {
	ImportedCollection,
	ImportedFolder,
	ImportedItem,
} from "./imported-collection.js";
import { derefLocal } from "./openapi-example.js";
import { authFromSecurity, operationToRequest } from "./openapi-operation.js";

/** Path item keys that are operations, in the order the spec lists them. */
const OPERATION_KEYS = [
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
] as const;

/** First server URL with its `{variables}` set to their defaults. */
function serverUrl(root: JsonRecord): string {
	const server = listProp(root, "servers")[0];
	let url = textProp(server, "url");
	const variables = recordProp(server, "variables");
	for (const name of keysOf(variables)) {
		const value = textProp(prop(variables, name), "default");
		url = url.split(`{${name}}`).join(value);
	}
	return url.replace(/\/+$/, "");
}

function folderFor(
	folders: Map<string, ImportedFolder>,
	tag: string,
	ctx: ImportContext,
): ImportedFolder {
	const found = folders.get(tag);
	if (found) return found;
	const folder: ImportedFolder = {
		kind: "folder",
		id: ctx.newId(),
		name: tag,
		description: "",
		auth: { type: "inherit" },
		scripts: { pre: "", post: "" },
		items: [],
	};
	folders.set(tag, folder);
	return folder;
}

/** Folders in the order of the document's `tags`, then of first use. */
function orderedFolders(
	root: JsonRecord,
	folders: Map<string, ImportedFolder>,
): ImportedFolder[] {
	const tags = listProp(root, "tags");
	const names = tags.map((tag) => textProp(tag, "name"));
	const rank = (name: string): number => {
		const index = names.indexOf(name);
		return index === -1 ? names.length : index;
	};
	return [...folders.values()]
		.map((folder, order) => ({ folder, order }))
		.sort(
			(a, b) => rank(a.folder.name) - rank(b.folder.name) || a.order - b.order,
		)
		.map(({ folder }) => {
			const tag = tags[names.indexOf(folder.name)];
			return {
				...folder,
				description: descriptionOf(prop(tag, "description")),
			};
		});
}

/** `root` is an object with `openapi: 3.x` (checked by `detect-format.ts`). */
export function openApiToTree(
	root: JsonRecord,
	ctx: ImportContext,
): ImportedCollection {
	const folders = new Map<string, ImportedFolder>();
	const loose: ImportedItem[] = [];
	const paths = recordProp(root, "paths");
	walk: for (const path of keysOf(paths)) {
		const pathItem = derefLocal(root, prop(paths, path), ctx, path);
		for (const key of OPERATION_KEYS) {
			const operation = recordProp(pathItem, key);
			if (operation === null) continue;
			const method = HTTP_METHODS.find((m) => m === key.toUpperCase());
			const tag = textOf(listProp(operation, "tags")[0]) ?? "";
			const itemPath = joinPath(tag, `${key.toUpperCase()} ${path}`);
			if (method === undefined) {
				ctx.warn("UNSUPPORTED_METHOD", itemPath, {
					method: paramText(key.toUpperCase()),
				});
				continue;
			}
			if (!ctx.takeItem(itemPath)) break walk;
			const request = operationToRequest(
				root,
				{ path, method, pathItem, operation },
				ctx,
				itemPath,
			);
			if (tag) folderFor(folders, tag, ctx).items.push(request);
			else loose.push(request);
		}
	}
	const info = recordProp(root, "info");
	const security = prop(root, "security");
	return {
		format: "openapi",
		name: textProp(info, "title"),
		description: descriptionOf(prop(info, "description")),
		auth: Array.isArray(security)
			? authFromSecurity(root, security, ctx, "")
			: { type: "none" },
		variables: [
			{ key: "baseUrl", value: serverUrl(root), secret: false, enabled: true },
		],
		scripts: { pre: "", post: "" },
		items: [...orderedFolders(root, folders), ...loose],
		warnings: ctx.warnings(),
	};
}
