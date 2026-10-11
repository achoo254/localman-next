import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import {
	type ElementAdapter,
	registerElementAdapter,
} from "../access/element-adapters.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import { assertWorkspaceRoom } from "./collection-store.js";

/**
 * Moves the root within the target workspace's room. 404 when the
 * collection was trashed or deleted since the caller loaded it, so a lost
 * race never reports a move that did not happen.
 */
async function moveRoot(
	collectionId: Types.ObjectId,
	workspaceId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	await assertWorkspaceRoom(workspaceId, session);
	const result = await CollectionModel.updateOne(
		{ _id: collectionId, ...LIVE_COLLECTION },
		{ $set: { workspaceId } },
		{ session },
	);
	if (result.matchedCount === 0) throw elementNotFound();
}

/**
 * Collections as the access layer sees them: live ones only (a trashed
 * collection answers 404 to share, move and access requests). A move
 * rewrites the root alone; nodes follow it by `collectionId`. Without a
 * caller's session it runs under the target workspace's lock, so it
 * cannot land in a workspace being deleted.
 */
export const collectionAdapter: ElementAdapter = {
	async load(id) {
		const _id = toObjectId(id);
		if (!_id) return null;
		const doc = await CollectionModel.findOne(
			{ _id, ...LIVE_COLLECTION },
			{ name: 1, workspaceId: 1 },
		).lean<{
			_id: Types.ObjectId;
			name: string;
			workspaceId: Types.ObjectId;
		}>();
		if (!doc) return null;
		return {
			type: "collection",
			id: doc._id.toHexString(),
			name: doc.name,
			workspaceId: doc.workspaceId,
		};
	},
	async moveTo(id, workspaceId, session) {
		const _id = toObjectId(id);
		if (!_id) throw new Error(`Invalid collection id: ${id}`);
		if (session) return moveRoot(_id, workspaceId, session);
		await inWorkspaceTransaction(workspaceId, (own) =>
			moveRoot(_id, workspaceId, own),
		);
	},
};

/** Plugs collections into the access layer (sharing, moving, requests). */
export function registerCollectionAdapter(): void {
	registerElementAdapter("collection", collectionAdapter);
}
