/**
 * A stored collection as the API serves it and the web edits it: the root
 * (name, Markdown description, auth, scripts, variables) and a flat list
 * of nodes (folders and requests) linked by `parentId` and ordered by a
 * fractional `order` key within their parent, so moving one node rewrites
 * one record. `collection-tree.ts` converts it to and from the
 * `CollectionTree` that import and export use.
 */
import { z } from "zod";
import type { ElementRole } from "../../access-permissions.js";
import type {
	ApiRequestDraft,
	EffectiveAuth,
	HttpMethod,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import {
	apiRequestDraftSchema,
	effectiveAuthSchema,
	requestAuthSchema,
	requestScriptsSchema,
} from "../request-schema.js";
import type { VariableEntry } from "../variable-interpolation.js";

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

export type CollectionNode = CollectionFolderNode | CollectionRequestNode;

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
	createdBy: string;
	createdAt: string;
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
	updatedAt: string;
}

const name = z.string().trim().min(1).max(COLLECTION_NAME_MAX);
const description = z.string().max(COLLECTION_DESCRIPTION_MAX);
export const variableEntrySchema: z.ZodType<VariableEntry> = z.object({
	key: z.string().trim().min(1).max(200),
	value: z.string().max(10_000),
	secret: z.boolean().optional(),
	enabled: z.boolean().optional(),
});
const orderKey = z.string().min(1).max(200);

/** Body of `PATCH /collections/:id`: the root's editable fields. */
export const collectionUpdateSchema = z
	.object({
		name,
		description,
		auth: effectiveAuthSchema,
		scripts: requestScriptsSchema,
		variables: z.array(variableEntrySchema).max(COLLECTION_VARIABLES_MAX),
	})
	.partial();

/** Body of `POST /collections/:id/nodes`: a new folder or request. */
export const nodeCreateSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("folder"),
		parentId: z.string().nullable(),
		name,
		/** Insert after this sibling; at the end when absent. */
		afterId: z.string().nullable().optional(),
	}),
	z.object({
		kind: z.literal("request"),
		parentId: z.string().nullable(),
		name,
		draft: apiRequestDraftSchema,
		afterId: z.string().nullable().optional(),
	}),
]);

/** Body of `PATCH /collections/:id/nodes/:nodeId`: fields of that kind only. */
export const nodeUpdateSchema = z
	.object({
		name,
		description,
		auth: requestAuthSchema,
		scripts: requestScriptsSchema,
		draft: apiRequestDraftSchema,
	})
	.partial();

/** Body of `POST /collections/:id/nodes/:nodeId/move`: a drop. */
export const nodeMoveSchema = z.object({
	parentId: z.string().nullable(),
	/** Neighbours at the drop position (`null` at either end). */
	beforeOrder: orderKey.nullable(),
	afterOrder: orderKey.nullable(),
});

/** Binds an API client tab to the request node it edits. */
export interface TabSource {
	collectionId: string;
	nodeId: string;
}

export const tabSourceSchema: z.ZodType<TabSource> = z.object({
	collectionId: z.string().min(1).max(64),
	nodeId: z.string().min(1).max(64),
});

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
