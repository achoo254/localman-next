/** Folders, requests and examples of a collection (`…/nodes`). */
import type {
	ApiRequestDraft,
	CollectionNode,
	ExampleResponse,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectArray, expectRecord } from "../../lib/json-guards";
import { parseNode } from "./collection-parsers";
import { collectionPath } from "./collections-api";

const nodePath = (collectionId: string, nodeId: string): string =>
	`${collectionPath(collectionId)}/nodes/${encodeURIComponent(nodeId)}`;

export type NodeCreate =
	| { kind: "folder"; parentId: string | null; name: string; afterId?: string }
	| {
			kind: "request";
			parentId: string | null;
			name: string;
			draft: ApiRequestDraft;
			afterId?: string;
	  }
	| {
			kind: "example";
			/** The request node it belongs to. */
			parentId: string;
			name: string;
			request: ApiRequestDraft;
			response: ExampleResponse;
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
	request?: ApiRequestDraft;
	response?: ExampleResponse;
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
