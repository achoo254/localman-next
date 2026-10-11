import { OperationError } from "@localman/operations";
import {
	COLLECTION_DEPTH_MAX,
	type CollectionNode,
	type nodeMoveSchema,
	orderKeyBetween,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import type { z } from "zod";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { toCollectionNode } from "./collection-view.js";
import {
	folderDepth,
	folderHeight,
	loadOutline,
	pathToTop,
} from "./node-outline.js";
import {
	assertParent,
	findNode,
	nodeNotFound,
	tooDeep,
} from "./node-service.js";
import { nodesRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";

export type NodeMove = z.infer<typeof nodeMoveSchema>;

function invalidOrder(): OperationError {
	return new OperationError(
		400,
		"INVALID_ORDER",
		"beforeOrder must be a valid order key below afterOrder",
	);
}

function lower(a: string | null, b: string | null): string | null {
	if (a === null) return b;
	if (b === null) return a;
	return a < b ? a : b;
}

/**
 * The key of a drop, from the siblings as stored rather than as the
 * client saw them: the upper bound is the lower of `afterOrder` and the
 * real next sibling after `beforeOrder` (the moved node aside), so drops
 * made from a stale view still land between distinct keys.
 */
async function dropKey(
	collectionId: Types.ObjectId,
	parentId: Types.ObjectId | null,
	selfId: Types.ObjectId,
	move: NodeMove,
	session: ClientSession,
): Promise<string> {
	const siblings = { collectionId, parentId, _id: { $ne: selfId } };
	const next = await CollectionNodeModel.findOne(
		move.beforeOrder === null
			? siblings
			: { ...siblings, order: { $gt: move.beforeOrder } },
		{ order: 1 },
	)
		.session(session)
		.sort({ order: 1 })
		.lean<{ order: string }>();
	const upper = lower(move.afterOrder, next?.order ?? null);
	const key = keyBetween(move.beforeOrder, upper);
	// Database errors stay out of the key checks: a transient transaction
	// error must reach `withTransaction` for its retry.
	const taken = await CollectionNodeModel.exists({
		...siblings,
		order: key,
	}).session(session);
	return taken ? keyBetween(key, upper) : key;
}

/** `orderKeyBetween`, a bad pair answering 400 `INVALID_ORDER`. */
function keyBetween(before: string | null, after: string | null): string {
	try {
		return orderKeyBetween(before, after);
	} catch {
		throw invalidOrder();
	}
}

/** The node at its new place (an example keeps its request). */
function placed(
	node: CollectionNode,
	parentId: string | null,
	order: string,
): CollectionNode {
	if (node.kind === "example") return { ...node, order };
	return { ...node, parentId, order };
}

/**
 * Drops a node under `parentId` between two siblings' order keys,
 * rewriting that node (and stamping the root, with a changelog entry).
 * A folder cannot go into its own subtree, nor nest folders deeper than
 * `COLLECTION_DEPTH_MAX`; an example only reorders under its request.
 */
export async function moveNode(
	sub: string,
	id: string,
	nodeId: string,
	move: NodeMove,
): Promise<CollectionNode> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	// Malformed or reversed keys answer 400 before anything is read.
	keyBetween(move.beforeOrder, move.afterOrder);
	// The node as moved: a deletion committed right after must not turn a
	// done move into 404.
	return inWorkspaceTransaction(element.workspaceId, async (session) => {
		// Read under the lock: a deletion or move committed meanwhile shows.
		const node = await findNode(collectionId, nodeId, session);
		const selfId = node._id.toHexString();
		const outline = await loadOutline(collectionId, session);
		const current = node.parentId?.toHexString() ?? null;
		if (node.kind === "example" && move.parentId !== current) {
			throw new OperationError(
				400,
				"INVALID_PARENT",
				"An example stays under its request",
			);
		}
		assertParent(outline, move.parentId, node.kind);
		if (pathToTop(outline, move.parentId).includes(selfId)) {
			throw new OperationError(
				400,
				"MOVE_CYCLE",
				"A folder cannot move into itself or one of its subfolders",
			);
		}
		const height = node.kind === "folder" ? folderHeight(outline, selfId) : 0;
		if (folderDepth(outline, move.parentId) + height > COLLECTION_DEPTH_MAX) {
			throw tooDeep();
		}
		const parentId =
			move.parentId === null ? null : new Types.ObjectId(move.parentId);
		const order = await dropKey(
			collectionId,
			parentId,
			node._id,
			move,
			session,
		);
		const before = toCollectionNode(node);
		const after = placed(before, move.parentId, order);
		const result = await CollectionNodeModel.updateOne(
			{ _id: node._id, collectionId },
			{ $set: { parentId, order, updatedBy: sub } },
			{ session },
		);
		if (result.matchedCount === 0) throw nodeNotFound();
		await chargeRoot(collectionId, sub, session, {
			revisions: [nodesRevision("move", after, [before], [after])],
		});
		return after;
	});
}
