import {
	COLLECTION_NODES_MAX,
	type CollectionNode,
	orderKeyBetween,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { nodeBytes } from "./collection-bytes.js";
import { copyName } from "./collection-duplicate-service.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import {
	newNodeId,
	nodesLimitReached,
	storedNodeOf,
} from "./collection-store.js";
import { toCollectionNode } from "./collection-view.js";
import { loadOutline, subtreeIds } from "./node-outline.js";
import { findNode, nodeNotFound } from "./node-service.js";
import { nodesRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";

/** The key right after `source` among its siblings. */
async function keyAfter(
	source: StoredCollectionNode,
	session: ClientSession,
): Promise<string> {
	const next = await CollectionNodeModel.findOne(
		{
			collectionId: source.collectionId,
			parentId: source.parentId,
			order: { $gt: source.order },
		},
		{ order: 1 },
	)
		.session(session)
		.sort({ order: 1 })
		.lean<{ order: string }>();
	return orderKeyBetween(source.order, next?.order ?? null);
}

/**
 * Copies a folder or request with everything under it as its next
 * sibling, named "<name> Copy", with new ids (Editor). One transaction
 * under the workspace lock: the node limit and the byte budget hold, and
 * nothing is written when either fails. Returns the new nodes, the copy
 * of `nodeId` first, parents before children.
 */
export async function duplicateNode(
	sub: string,
	id: string,
	nodeId: string,
): Promise<CollectionNode[]> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const sourceId = (await findNode(collectionId, nodeId))._id;
	return inWorkspaceTransaction(element.workspaceId, async (session) => {
		const outline = await loadOutline(collectionId, session);
		if (!outline.has(sourceId.toHexString())) throw nodeNotFound();
		const ids = subtreeIds(outline, sourceId.toHexString());
		if (outline.size + ids.length > COLLECTION_NODES_MAX) {
			throw nodesLimitReached(outline.size + ids.length);
		}
		const docs = await CollectionNodeModel.find({
			collectionId,
			_id: { $in: ids.map((at) => new Types.ObjectId(at)) },
		})
			.session(session)
			.lean<StoredCollectionNode[]>();
		const byId = new Map(docs.map((doc) => [doc._id.toHexString(), doc]));
		const source = byId.get(sourceId.toHexString());
		if (!source) throw nodeNotFound();
		const newIds = new Map(ids.map((at) => [at, newNodeId()]));
		const order = await keyAfter(source, session);
		const copies = ids.flatMap((at): CollectionNode[] => {
			const doc = byId.get(at);
			if (!doc) return [];
			const node = toCollectionNode(doc);
			const id = newIds.get(at) ?? newNodeId();
			if (at === source._id.toHexString()) {
				return [{ ...node, id, order, name: copyName(node.name) }];
			}
			// Below the source: its parent is in the subtree, copied too.
			const parentId =
				node.parentId === null ? null : (newIds.get(node.parentId) ?? null);
			if (node.kind !== "example") return [{ ...node, id, parentId }];
			return parentId === null ? [] : [{ ...node, id, parentId }];
		});
		const [top] = copies;
		if (!top) throw nodeNotFound();
		await chargeRoot(collectionId, sub, session, {
			bytes: copies.reduce((sum, node) => sum + nodeBytes(node), 0),
			requests: copies.filter((node) => node.kind === "request").length,
			revisions: [nodesRevision("create", top, [], copies)],
		});
		await CollectionNodeModel.insertMany(
			copies.map((node) => storedNodeOf(node, collectionId, sub)),
			{ session },
		);
		return copies;
	});
}
