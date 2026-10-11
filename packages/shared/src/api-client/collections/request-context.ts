/**
 * What a request of a stored collection takes from above it: the auth an
 * `inherit` request uses and where that auth is set, the scripts that run
 * around it (collection, then folders outer to inner, then the request),
 * the collection variables and its folder path. A parent that is missing,
 * not a folder, or closes a cycle ends the walk: the node below it counts
 * as top level.
 */
import { resolveEffectiveAuth } from "../auth-headers.js";
import type { EffectiveAuth, RequestScripts } from "../request-model.js";
import type { VariableEntry } from "../variable-interpolation.js";
import type {
	CollectionDetail,
	CollectionFolderNode,
} from "./collection-model.js";

export interface CollectionNodeRef {
	id: string;
	name: string;
}

/** The collection or folder whose auth an `inherit` request uses. */
export interface InheritedAuthSource extends CollectionNodeRef {
	kind: "collection" | "folder";
}

export interface RequestContext {
	/** Auth applied when the request's own auth is `inherit`. */
	inheritedAuth: EffectiveAuth;
	authSource: InheritedAuthSource;
	/** Non-blank scripts in run order: collection, folders, request. */
	preScripts: string[];
	postScripts: string[];
	/** Collection variables. */
	variables: VariableEntry[];
	/** Folders above the request, outermost first. */
	folderPath: CollectionNodeRef[];
}

/** Folders above `parentId`, outermost first. */
function foldersAbove(
	detail: CollectionDetail,
	parentId: string | null,
): CollectionFolderNode[] {
	const byId = new Map(detail.nodes.map((node) => [node.id, node]));
	const chain: CollectionFolderNode[] = [];
	const seen = new Set<string>();
	let id = parentId;
	while (id !== null && !seen.has(id)) {
		seen.add(id);
		const node = byId.get(id);
		if (node?.kind !== "folder") break;
		chain.push(node);
		id = node.parentId;
	}
	return chain.reverse();
}

const nonBlank = (scripts: string[]): string[] =>
	scripts.filter((script) => script.trim() !== "");

/**
 * Context of request `requestId`; `null` when the collection has no such
 * request. `own` replaces the stored request's scripts (an open tab with
 * unsaved edits).
 */
export function requestContext(
	detail: CollectionDetail,
	requestId: string,
	own?: RequestScripts,
): RequestContext | null {
	const node = detail.nodes.find((item) => item.id === requestId);
	if (node?.kind !== "request") return null;
	const folders = foldersAbove(detail, node.parentId);
	let inheritedAuth: EffectiveAuth = detail.auth;
	let authSource: InheritedAuthSource = {
		kind: "collection",
		id: detail.id,
		name: detail.name,
	};
	for (const folder of folders) {
		inheritedAuth = resolveEffectiveAuth(folder.auth, inheritedAuth);
		if (folder.auth.type !== "inherit") {
			authSource = { kind: "folder", id: folder.id, name: folder.name };
		}
	}
	const scripts = [
		detail.scripts,
		...folders.map((folder) => folder.scripts),
		own ?? node.draft.scripts,
	];
	return {
		inheritedAuth,
		authSource,
		preScripts: nonBlank(scripts.map((s) => s.pre)),
		postScripts: nonBlank(scripts.map((s) => s.post)),
		variables: [...detail.variables],
		folderPath: folders.map(({ id, name }) => ({ id, name })),
	};
}
