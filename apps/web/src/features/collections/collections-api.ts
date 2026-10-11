/**
 * Collections of the API client (`/api/v1/workspaces/:id/collections`,
 * `/api/v1/collections/...`) and moving one to another workspace
 * (`/api/v1/elements/collection/:id/move`). Every answer is parsed.
 */
import type {
	ApiRequestDraft,
	CollectionDetail,
	CollectionNode,
	CollectionSummary,
	CollectionTree,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectArray, expectRecord } from "../../lib/json-guards";
import { parseDetail, parseNode, parseSummary } from "./collection-parsers";

export const collectionPath = (id: string): string =>
	`/api/v1/collections/${encodeURIComponent(id)}`;
const nodePath = (collectionId: string, nodeId: string): string =>
	`${collectionPath(collectionId)}/nodes/${encodeURIComponent(nodeId)}`;

/** Favorites of the caller first, then by name. */
export async function fetchCollections(
	workspaceId: string,
): Promise<CollectionSummary[]> {
	const data = expectRecord(
		await apiRequest(
			`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/collections`,
		),
		"collection list",
	);
	return expectArray(data, "items").map(parseSummary);
}

export async function fetchCollection(id: string): Promise<CollectionDetail> {
	return parseDetail(await apiRequest(collectionPath(id)));
}

/** A blank collection (`name`), the REST CRUD template, or an imported tree. */
export type CollectionSource =
	| { name: string }
	| { template: "rest-crud" }
	| { tree: CollectionTree };

export async function createCollection(
	workspaceId: string,
	source: CollectionSource,
): Promise<CollectionDetail> {
	return parseDetail(
		await apiRequest(
			`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/collections`,
			{ method: "POST", body: source },
		),
	);
}

/** Root fields of a collection; round 2 edits description, auth and more. */
export type CollectionPatch = Partial<
	Pick<
		CollectionDetail,
		"name" | "description" | "auth" | "scripts" | "variables"
	>
>;

export async function updateCollection(
	id: string,
	patch: CollectionPatch,
): Promise<CollectionDetail> {
	return parseDetail(
		await apiRequest(collectionPath(id), { method: "PATCH", body: patch }),
	);
}

export async function duplicateCollection(
	id: string,
): Promise<CollectionDetail> {
	return parseDetail(
		await apiRequest(`${collectionPath(id)}/duplicate`, { method: "POST" }),
	);
}

export async function setFavorite(
	id: string,
	favorite: boolean,
): Promise<void> {
	await apiRequest(`${collectionPath(id)}/favorite`, {
		method: favorite ? "PUT" : "DELETE",
	});
}

/** Phase 11 move of a shareable element to another workspace. */
export async function moveCollectionToWorkspace(
	id: string,
	workspaceId: string,
): Promise<void> {
	await apiRequest(
		`/api/v1/elements/collection/${encodeURIComponent(id)}/move`,
		{ method: "POST", body: { workspaceId } },
	);
}

export type NodeCreate =
	| { kind: "folder"; parentId: string | null; name: string; afterId?: string }
	| {
			kind: "request";
			parentId: string | null;
			name: string;
			draft: ApiRequestDraft;
			afterId?: string;
	  };

export async function createNode(
	collectionId: string,
	node: NodeCreate,
): Promise<CollectionNode> {
	return parseNode(
		await apiRequest(`${collectionPath(collectionId)}/nodes`, {
			method: "POST",
			body: node,
		}),
	);
}

/** Fields of the node's own kind only (the API refuses the others). */
export interface NodePatch {
	name?: string;
	description?: string;
	auth?: Extract<CollectionNode, { kind: "folder" }>["auth"];
	scripts?: Extract<CollectionNode, { kind: "folder" }>["scripts"];
	draft?: ApiRequestDraft;
}

export async function updateNode(
	collectionId: string,
	nodeId: string,
	patch: NodePatch,
): Promise<CollectionNode> {
	return parseNode(
		await apiRequest(nodePath(collectionId, nodeId), {
			method: "PATCH",
			body: patch,
		}),
	);
}

/** A drop: the new parent and the order keys of the neighbours around it. */
export interface NodeMove {
	parentId: string | null;
	beforeOrder: string | null;
	afterOrder: string | null;
}

export async function moveNode(
	collectionId: string,
	nodeId: string,
	move: NodeMove,
): Promise<CollectionNode> {
	return parseNode(
		await apiRequest(`${nodePath(collectionId, nodeId)}/move`, {
			method: "POST",
			body: move,
		}),
	);
}

/** Deletes the node and its subtree for good. */
export async function deleteNode(
	collectionId: string,
	nodeId: string,
): Promise<void> {
	await apiRequest(nodePath(collectionId, nodeId), { method: "DELETE" });
}

/**
 * Copies a folder or request with everything inside, right after it, in
 * one step; resolves with the new nodes (the copy first, parents before
 * children).
 */
export async function duplicateNode(
	collectionId: string,
	nodeId: string,
): Promise<CollectionNode[]> {
	const data = expectRecord(
		await apiRequest(`${nodePath(collectionId, nodeId)}/duplicate`, {
			method: "POST",
		}),
		"duplicated nodes",
	);
	return expectArray(data, "nodes").map(parseNode);
}
