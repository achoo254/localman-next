/**
 * Collections of the API client (`/api/v1/workspaces/:id/collections`,
 * `/api/v1/collections/...`) and moving one to another workspace
 * (`/api/v1/elements/collection/:id/move`). Every answer is parsed.
 */
import type {
	CollectionDetail,
	CollectionSummary,
	CollectionTree,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectArray, expectRecord } from "../../lib/json-guards";
import { parseDetail, parseSummary } from "./collection-parsers";

export const collectionPath = (id: string): string =>
	`/api/v1/collections/${encodeURIComponent(id)}`;

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

/**
 * A blank collection (`name`), the REST CRUD template, or an imported tree
 * (with the mock project it is made from, when it is one).
 */
export type CollectionSource =
	| { name: string }
	| { template: "rest-crud" }
	| { tree: CollectionTree; mockProjectId?: string };

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

/** Root fields of a collection, and its related environment (`null`: none). */
export type CollectionPatch = Partial<
	Pick<
		CollectionDetail,
		| "name"
		| "description"
		| "auth"
		| "scripts"
		| "variables"
		| "tags"
		| "status"
	> & { linkedEnvironmentId: string | null }
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
