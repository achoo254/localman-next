import { COLLECTION_NODES_MAX } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { CollectionNodeModel } from "./collection-node-model.js";

/** Where a node sits, without its content. */
export interface OutlineNode {
	readonly kind: "folder" | "request" | "example";
	readonly parentId: string | null;
}

/** Node id to kind and parent, for structural checks. */
export type Outline = ReadonlyMap<string, OutlineNode>;

/**
 * The outline of a collection. Structural writes (create, move, delete)
 * read it in a transaction holding the workspace lock, so two moves cannot
 * both pass the cycle check, nor a node land in a subtree being deleted.
 */
export async function loadOutline(
	collectionId: Types.ObjectId,
	session: ClientSession,
): Promise<Outline> {
	const rows = await CollectionNodeModel.find(
		{ collectionId },
		{ kind: 1, parentId: 1 },
	)
		.session(session)
		.limit(COLLECTION_NODES_MAX)
		.lean<
			{
				_id: Types.ObjectId;
				kind: OutlineNode["kind"];
				parentId: Types.ObjectId | null;
			}[]
		>();
	return new Map(
		rows.map((row) => [
			row._id.toHexString(),
			{ kind: row.kind, parentId: row.parentId?.toHexString() ?? null },
		]),
	);
}

/**
 * Ids from `id` up to the top, `id` first. Stops at a missing parent or a
 * repeated id, so a corrupt outline cannot loop.
 */
export function pathToTop(outline: Outline, id: string | null): string[] {
	const path: string[] = [];
	for (let at = id; at !== null && !path.includes(at); ) {
		const node = outline.get(at);
		if (!node) break;
		path.push(at);
		at = node.parentId;
	}
	return path;
}

/** Folders from `id` to the top, `id` included (a top-level folder is 1). */
export function folderDepth(outline: Outline, id: string | null): number {
	return pathToTop(outline, id).filter(
		(at) => outline.get(at)?.kind === "folder",
	).length;
}

/** `id` and every node below it, `id` first. */
export function subtreeIds(outline: Outline, id: string): string[] {
	const children = new Map<string, string[]>();
	for (const [nodeId, node] of outline) {
		if (node.parentId === null) continue;
		const siblings = children.get(node.parentId);
		if (siblings) siblings.push(nodeId);
		else children.set(node.parentId, [nodeId]);
	}
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const queue = [id]; queue.length > 0; ) {
		const next = queue.shift();
		if (next === undefined || seen.has(next)) continue;
		seen.add(next);
		ids.push(next);
		queue.push(...(children.get(next) ?? []));
	}
	return ids;
}

/** Levels of folders in the subtree of `id` (1 for a folder holding none). */
export function folderHeight(outline: Outline, id: string): number {
	let height = 0;
	for (const nodeId of subtreeIds(outline, id)) {
		if (outline.get(nodeId)?.kind !== "folder") continue;
		const below = pathToTop(outline, nodeId);
		height = Math.max(height, below.indexOf(id) + 1);
	}
	return height;
}

export interface KindCounts {
	folders: number;
	requests: number;
	examples: number;
}

/** Folders, requests and examples among `ids`. */
export function countKinds(
	outline: Outline,
	ids: readonly string[],
): KindCounts {
	const counts = { folders: 0, requests: 0, examples: 0 };
	for (const id of ids) {
		const kind = outline.get(id)?.kind;
		if (kind === "folder") counts.folders += 1;
		else if (kind === "request") counts.requests += 1;
		else if (kind === "example") counts.examples += 1;
	}
	return counts;
}
