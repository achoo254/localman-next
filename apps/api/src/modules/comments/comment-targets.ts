import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "../collections/collection-model.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "../collections/collection-node-model.js";
import type { CommentTarget } from "./comment-anchor.js";

/** Node fields a comment target and a notification need. */
const NODE_FIELDS = { kind: 1, name: 1, scripts: 1, draft: 1 } as const;

export interface LoadedTarget {
	readonly target: CommentTarget;
	/** The node's name, `null` for the collection itself. */
	readonly nodeName: string | null;
}

function nodeTarget(node: StoredCollectionNode): CommentTarget {
	switch (node.kind) {
		case "folder":
			return { kind: "folder", scripts: node.scripts };
		case "request":
			return { kind: "request", draft: node.draft };
		default:
			return { kind: "example" };
	}
}

/** Parses a node id of a request; 404 for a malformed one. */
export function nodeObjectId(nodeId: string): Types.ObjectId {
	if (!Types.ObjectId.isValid(nodeId)) throw nodeNotFound();
	return new Types.ObjectId(nodeId);
}

function nodeNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Item not found");
}

/**
 * The collection (`nodeId` null) or its node a comment is written on;
 * 404 when the node is not in this collection.
 */
export async function loadTarget(
	collectionId: Types.ObjectId,
	nodeId: Types.ObjectId | null,
): Promise<LoadedTarget> {
	if (nodeId === null) {
		const root = await CollectionModel.findOne(
			{ _id: collectionId, ...LIVE_COLLECTION },
			{ scripts: 1 },
		).lean<Pick<StoredCollection, "scripts">>();
		if (!root) throw nodeNotFound();
		return {
			target: { kind: "collection", scripts: root.scripts },
			nodeName: null,
		};
	}
	const node = await CollectionNodeModel.findOne(
		{ _id: nodeId, collectionId },
		NODE_FIELDS,
	).lean<StoredCollectionNode>();
	if (!node) throw nodeNotFound();
	return { target: nodeTarget(node), nodeName: node.name };
}
