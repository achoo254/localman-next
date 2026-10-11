import {
	COLLECTION_DEPTH_MAX,
	COLLECTION_SEARCH_RESULTS_MAX,
	type CollectionSearchMatch,
	type CollectionSearchResult,
	type HttpMethod,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { type ListedRoot, visibleRoots } from "./collection-list-service.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { escapeRegExp, foldSearchText } from "./search-text.js";

interface NodeHit {
	_id: Types.ObjectId;
	collectionId: Types.ObjectId;
	parentId: Types.ObjectId | null;
	kind: "folder" | "request";
	name: string;
	/** Only `draft.method` is projected; the rest of the draft stays in Mongo. */
	draft?: { method?: HttpMethod };
}

interface FolderLink {
	_id: Types.ObjectId;
	name: string;
	parentId: Types.ObjectId | null;
}

const MAX = COLLECTION_SEARCH_RESULTS_MAX;

/**
 * The folders above `hits`, fetched one level per round (at most
 * `COLLECTION_DEPTH_MAX` rounds, each a bounded `$in` by id).
 */
async function foldersAbove(
	hits: readonly NodeHit[],
): Promise<Map<string, FolderLink>> {
	const folders = new Map<string, FolderLink>();
	const unseen = (ids: (Types.ObjectId | null)[]) => [
		...new Set(
			ids.flatMap((id) =>
				id && !folders.has(id.toHexString()) ? [id.toHexString()] : [],
			),
		),
	];
	let pending = unseen(hits.map((hit) => hit.parentId));
	for (
		let round = 0;
		pending.length > 0 && round < COLLECTION_DEPTH_MAX;
		round += 1
	) {
		const rows = await CollectionNodeModel.find(
			{ _id: { $in: pending }, kind: "folder" },
			{ name: 1, parentId: 1 },
		).lean<FolderLink[]>();
		for (const row of rows) folders.set(row._id.toHexString(), row);
		pending = unseen(rows.map((row) => row.parentId));
	}
	return folders;
}

function pathOf(hit: NodeHit, folders: Map<string, FolderLink>): string[] {
	const path: string[] = [];
	const seen = new Set<string>();
	for (let at = hit.parentId; at && !seen.has(at.toHexString()); ) {
		seen.add(at.toHexString());
		const folder = folders.get(at.toHexString());
		if (!folder) break;
		path.unshift(folder.name);
		at = folder.parentId;
	}
	return path;
}

function collectionMatch(root: ListedRoot): CollectionSearchMatch {
	const collectionId = root._id.toHexString();
	const name = root.name;
	return {
		collectionId,
		collectionName: name,
		nodeId: null,
		kind: "collection",
		name,
		path: [],
	};
}

/**
 * Collections, folders and requests of the workspace whose name holds `q`
 * (case and accents ignored), among those the caller may open: at most
 * `COLLECTION_SEARCH_RESULTS_MAX`, collections first. Node names are
 * matched on their folded copy (`searchName`) through the index.
 */
export async function searchCollections(
	sub: string,
	workspaceId: string,
	q: string,
): Promise<CollectionSearchResult> {
	const { roots } = await visibleRoots(sub, workspaceId);
	const needle = foldSearchText(q);
	if (needle.length === 0) return { matches: [], truncated: false };
	const collections = roots
		.filter((root) => foldSearchText(root.name).includes(needle))
		.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
		.map(collectionMatch);
	const matches = collections.slice(0, MAX);
	const filter = {
		collectionId: { $in: roots.map((root) => root._id) },
		searchName: { $regex: escapeRegExp(needle) },
	};
	const room = MAX - matches.length;
	if (room === 0) {
		const more =
			collections.length > MAX ||
			(await CollectionNodeModel.exists(filter)) !== null;
		return { matches, truncated: more };
	}
	const hits = await CollectionNodeModel.find(filter, {
		collectionId: 1,
		parentId: 1,
		kind: 1,
		name: 1,
		"draft.method": 1,
	})
		.sort({ collectionId: 1, searchName: 1 })
		.limit(room + 1)
		.lean<NodeHit[]>();
	const shown = hits.slice(0, room);
	const folders = await foldersAbove(shown);
	const names = new Map(
		roots.map((root) => [root._id.toHexString(), root.name]),
	);
	for (const hit of shown) {
		const collectionId = hit.collectionId.toHexString();
		const method = hit.kind === "request" ? hit.draft?.method : undefined;
		matches.push({
			collectionId,
			collectionName: names.get(collectionId) ?? "",
			nodeId: hit._id.toHexString(),
			kind: hit.kind,
			name: hit.name,
			...(method ? { method } : {}),
			path: pathOf(hit, folders),
		});
	}
	return { matches, truncated: hits.length > room };
}
