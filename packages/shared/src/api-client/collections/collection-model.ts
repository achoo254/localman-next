/**
 * A stored collection as the API serves it and the web edits it: the root
 * (name, Markdown description, auth, scripts, variables) and a flat list
 * of nodes (folders and requests) linked by `parentId` and ordered by a
 * fractional `order` key within their parent, so moving one node rewrites
 * one record. `collection-tree.ts` converts it to and from the
 * `CollectionTree` that import and export use.
 */
import type { ElementRole } from "../../access-permissions.js";
import type {
	ApiRequestDraft,
	EffectiveAuth,
	HttpMethod,
	KeyValueRow,
	RawLanguage,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import type { VariableEntry } from "../variable-interpolation.js";
import type { CollectionStatus } from "./collection-tags.js";

export const COLLECTION_NAME_MAX = 200;
export const COLLECTION_DESCRIPTION_MAX = 20_000;
export const COLLECTION_VARIABLES_MAX = 200;
/** Folders and requests of one collection. */
export const COLLECTION_NODES_MAX = 2_000;
/** Typed in the delete dialog of a collection that holds requests. */
export const DELETE_CONFIRMATION = "delete";

export interface CollectionFolderNode {
	kind: "folder";
	id: string;
	/** `null` at the top of the collection. */
	parentId: string | null;
	/** Fractional index key, compared as a plain string. */
	order: string;
	name: string;
	description: string;
	/** `inherit` unless the folder sets its own. */
	auth: RequestAuth;
	scripts: RequestScripts;
}

export interface CollectionRequestNode {
	kind: "request";
	id: string;
	parentId: string | null;
	order: string;
	name: string;
	description: string;
	draft: ApiRequestDraft;
}

/** Body of a saved example response; larger bodies are cut when saved. */
export const EXAMPLE_BODY_MAX = 512 * 1024;

/** A saved response of a request (Postman "example"). */
export interface ExampleResponse {
	status: number;
	statusText: string;
	headers: KeyValueRow[];
	body: string;
	bodyLanguage: RawLanguage;
}

/**
 * An example: a child of a request node holding the request as it was sent
 * and the response saved from it (or written by hand).
 */
export interface CollectionExampleNode {
	kind: "example";
	id: string;
	/** The request node it belongs to. */
	parentId: string;
	order: string;
	name: string;
	request: ApiRequestDraft;
	response: ExampleResponse;
}

export type CollectionNode =
	| CollectionFolderNode
	| CollectionRequestNode
	| CollectionExampleNode;

export {
	COLLECTION_STATUS_PRESETS,
	COLLECTION_TAG_MAX_LENGTH,
	COLLECTION_TAGS_MAX,
	type CollectionStatus,
	type CollectionStatusPreset,
} from "./collection-tags.js";

/** One collection with every node, as `GET /collections/:id` serves it. */
export interface CollectionDetail {
	id: string;
	workspaceId: string;
	/** The caller's role on it: an Editor edits, a Viewer only reads. */
	role: ElementRole;
	name: string;
	description: string;
	/** What top-level items inherit; never `inherit` itself. */
	auth: EffectiveAuth;
	scripts: RequestScripts;
	variables: VariableEntry[];
	/** Lower-case, at most `COLLECTION_TAGS_MAX`. */
	tags: string[];
	status: CollectionStatus | null;
	createdBy: string;
	/** Name (else username) of the creator; `null` for a removed account. */
	createdByName: string | null;
	createdAt: string;
	/** Who changed it last (root or any node). */
	updatedBy: string;
	updatedByName: string | null;
	updatedAt: string;
	nodes: CollectionNode[];
}

/** A collection in the sidebar list of a workspace. */
export interface CollectionSummary {
	id: string;
	workspaceId: string;
	/** The caller's role on it (workspace role or share, the stronger). */
	role: ElementRole;
	name: string;
	/** Favorites of the caller come first in the sidebar. */
	favorite: boolean;
	requestCount: number;
	tags: string[];
	status: CollectionStatus | null;
	updatedAt: string;
}

/** Binds an API client tab to the request node it edits. */
export interface TabSource {
	collectionId: string;
	nodeId: string;
}

/** Longest search text and most matches of one collection search. */
export const COLLECTION_SEARCH_QUERY_MAX = 100;
export const COLLECTION_SEARCH_RESULTS_MAX = 100;

/** One hit of `GET /workspaces/:id/collections/search`. */
export interface CollectionSearchMatch {
	collectionId: string;
	collectionName: string;
	/** `null` when the collection itself matched. */
	nodeId: string | null;
	kind: "collection" | "folder" | "request";
	name: string;
	/** Requests only. */
	method?: HttpMethod;
	/** Names of the folders above the node, outermost first. */
	path: string[];
}

export interface CollectionSearchResult {
	/** Collections first (by name), then folders and requests. */
	matches: CollectionSearchMatch[];
	/** More matched than `COLLECTION_SEARCH_RESULTS_MAX`. */
	truncated: boolean;
}
