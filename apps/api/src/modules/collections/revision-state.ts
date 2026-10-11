import type { CollectionNode } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "./collection-model.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import { toCollectionNode } from "./collection-view.js";
import { rootStateOf } from "./revision-drafts.js";
import type { CollectionState, StateSlice } from "./revision-patch.js";

/** The live collection's state document (root content and every node). */
export async function loadState(
	collectionId: Types.ObjectId,
	session?: ClientSession,
): Promise<CollectionState> {
	const root = await CollectionModel.findOne({
		_id: collectionId,
		...LIVE_COLLECTION,
	})
		.session(session ?? null)
		.lean<StoredCollection>();
	if (!root) throw elementNotFound();
	const nodes = await CollectionNodeModel.find({ collectionId })
		.session(session ?? null)
		.lean<StoredCollectionNode[]>();
	return {
		root: rootStateOf(root),
		nodes: Object.fromEntries(
			nodes.map((node) => [node._id.toHexString(), toCollectionNode(node)]),
		),
	};
}

/** The current state of one entity only (`root` or a node id). */
export async function loadEntitySlice(
	collectionId: Types.ObjectId,
	entity: string,
): Promise<StateSlice> {
	if (entity === "root") {
		const root = await CollectionModel.findOne({
			_id: collectionId,
			...LIVE_COLLECTION,
		}).lean<StoredCollection>();
		if (!root) throw elementNotFound();
		return { root: rootStateOf(root), nodes: {} };
	}
	const node = await CollectionNodeModel.findOne({
		collectionId,
		_id: entity,
	}).lean<StoredCollectionNode>();
	const nodes: Record<string, CollectionNode> = node
		? { [entity]: toCollectionNode(node) }
		: {};
	return { nodes };
}

/** The entity's value in a slice, `null` when absent. */
export function entityIn(slice: StateSlice, entity: string): unknown {
	return entity === "root"
		? (slice.root ?? null)
		: (slice.nodes[entity] ?? null);
}
