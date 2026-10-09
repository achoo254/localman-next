/**
 * A collection tree (the open tabs) to an OpenAPI 3.0.3 document in JSON.
 * Each request becomes an operation under its path; the first folder name
 * is its tag. `{{baseUrl}}` stays a server variable, `{{id}}` in the path
 * becomes the path parameter `{id}`. Two requests on the same method and
 * path keep the first; `skipped` counts the others.
 */
import type { JsonObject } from "../../json-value.js";
import { resolveEffectiveAuth } from "../auth-headers.js";
import {
	type CollectionTree,
	flattenImportedRequests,
} from "../import/imported-collection.js";
import { operationFor, securityScheme } from "./openapi-export-operation.js";

export interface OpenApiExport {
	document: JsonObject;
	/** Requests left out because another one has the same method and path. */
	skipped: number;
}

const SERVER_AND_PATH =
	/^((?:[a-zA-Z][\w+.-]*:\/\/[^/?#]*)|(?:\{\{[^{}]+\}\}))?([^?#]*)/;

/** `https://api.example.com/users/{{id}}?x=1` → server and templated path. */
export function splitRequestUrl(url: string): { server: string; path: string } {
	const [, server = "", rawPath = ""] = SERVER_AND_PATH.exec(url.trim()) ?? [];
	const path = rawPath.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, "{$1}");
	return {
		server: server.replace(/^\{\{\s*([^{}\s]+)\s*\}\}$/, "{$1}"),
		path: path.startsWith("/") ? path : `/${path}`,
	};
}

/** Server objects; `{name}` servers get a variable with the collection value. */
function serverObject(url: string, tree: CollectionTree): JsonObject {
	const name = /^\{([^{}]+)\}$/.exec(url)?.[1];
	if (name === undefined) return { url };
	const variable = tree.variables.find((v) => v.key.trim() === name);
	return { url, variables: { [name]: { default: variable?.value ?? "" } } };
}

export function exportOpenApi(tree: CollectionTree): OpenApiExport {
	const servers: string[] = [];
	const paths = new Map<string, JsonObject>();
	const schemes = new Map<string, JsonObject>();
	let skipped = 0;
	for (const request of flattenImportedRequests(tree)) {
		const { draft } = request;
		const { server, path } = splitRequestUrl(draft.url);
		const method = draft.method.toLowerCase();
		const pathItem = paths.get(path) ?? {};
		if (pathItem[method] !== undefined) {
			skipped += 1;
			continue;
		}
		const auth = resolveEffectiveAuth(draft.auth, request.inheritedAuth);
		const security = securityScheme(auth);
		if (security) schemes.set(security.name, security.scheme);
		const tag = request.folderPath[0] ?? null;
		const operation = operationFor(
			request.name,
			request.description,
			draft,
			path,
			tag,
			security,
		);
		if (server && !servers.includes(server)) servers.push(server);
		if (server && server !== servers[0]) {
			operation.servers = [serverObject(server, tree)];
		}
		paths.set(path, { ...pathItem, [method]: operation });
	}
	const info: JsonObject = { title: tree.name || "API", version: "1.0.0" };
	if (tree.description) info.description = tree.description;
	const document: JsonObject = { openapi: "3.0.3", info };
	if (servers.length > 0) document.servers = [serverObject(servers[0], tree)];
	document.paths = Object.fromEntries(paths);
	if (schemes.size > 0) {
		document.components = { securitySchemes: Object.fromEntries(schemes) };
	}
	return { document, skipped };
}
