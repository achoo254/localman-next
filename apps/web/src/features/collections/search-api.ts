/** Server search of a workspace's collections, folders and requests by name. */
import {
	COLLECTION_SEARCH_QUERY_MAX,
	type CollectionSearchMatch,
	type CollectionSearchResult,
	HTTP_METHODS,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

const KINDS = ["collection", "folder", "request"] as const;

function parseMatch(value: unknown): CollectionSearchMatch {
	const data = expectRecord(value, "search match");
	const kind = KINDS.find((item) => item === data.kind);
	if (!kind) throw new InvalidResponseError("match kind");
	const method = HTTP_METHODS.find((item) => item === data.method);
	if (data.method !== undefined && !method) {
		throw new InvalidResponseError("match method");
	}
	return {
		collectionId: expectString(data, "collectionId"),
		collectionName: expectString(data, "collectionName"),
		nodeId: optionalString(data, "nodeId"),
		kind,
		name: expectString(data, "name"),
		...(method ? { method } : {}),
		path: expectArray(data, "path").map((part) => {
			if (typeof part !== "string") throw new InvalidResponseError("path");
			return part;
		}),
	};
}

/** `q` is trimmed and cut to what the API takes. */
export async function searchCollections(
	workspaceId: string,
	q: string,
	signal?: AbortSignal,
): Promise<CollectionSearchResult> {
	const query = encodeURIComponent(
		q.trim().slice(0, COLLECTION_SEARCH_QUERY_MAX),
	);
	const data = expectRecord(
		await apiRequest(
			`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/collections/search?q=${query}`,
			{ signal },
		),
		"collection search",
	);
	return {
		matches: expectArray(data, "matches").map(parseMatch),
		truncated: expectBoolean(data, "truncated"),
	};
}
