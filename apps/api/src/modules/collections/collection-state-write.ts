import { COLLECTION_NODES_MAX } from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import {
	COLLECTION_BYTES_MAX,
	collectionTooLarge,
	nodeBytes,
	rootBytes,
} from "./collection-bytes.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	assertNodeSize,
	nodesLimitReached,
	storedNodeOf,
} from "./collection-store.js";
import { type CollectionState, buildRevision } from "./revision-patch.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

const stateBytes = (state: CollectionState): number =>
	Object.values(state.nodes).reduce(
		(sum, node) => sum + nodeBytes(node),
		rootBytes(state.root),
	);
const stateRequests = (state: CollectionState): number =>
	Object.values(state.nodes).filter((node) => node.kind === "request").length;

/** How a whole-collection write is recorded. */
export interface StateWrite {
	/** `restore`, `merge` or `pull`. */
	readonly action: "restore" | "merge" | "pull";
	/** Shown in the changelog; the collection's name when absent. */
	readonly entityName?: string;
	readonly dryRun: boolean;
}

/**
 * Writes `target` over `current` (changed and gone nodes, new nodes, root)
 * in the caller's transaction, as one revision of `write.action`, within
 * the node limit and byte budget; a dry run only checks the limits.
 * Returns whether the revision would be kept without patches (it then
 * cannot be undone).
 */
export async function writeCollectionState(
	collectionId: Types.ObjectId,
	sub: string,
	session: ClientSession,
	states: { current: CollectionState; target: CollectionState },
	write: StateWrite,
): Promise<boolean> {
	const { dryRun } = write;
	const { current, target } = states;
	const nodes = Object.values(target.nodes);
	if (nodes.length > COLLECTION_NODES_MAX)
		throw nodesLimitReached(nodes.length);
	const bytes = stateBytes(target) - stateBytes(current);
	if (bytes > 0 && stateBytes(target) > COLLECTION_BYTES_MAX) {
		throw collectionTooLarge(stateBytes(target));
	}
	const revision = buildRevision({
		entity: "collection",
		entityId: collectionId.toHexString(),
		entityKind: "collection",
		entityName: write.entityName ?? target.root.name,
		action: write.action,
		before: current,
		after: target,
	});
	if (dryRun) return revision.partial;
	await chargeRoot(collectionId, sub, session, {
		bytes,
		requests: stateRequests(target) - stateRequests(current),
		set: { ...target.root, searchName: foldSearchText(target.root.name) },
		revisions: [revision],
	});
	const same = (id: string) =>
		JSON.stringify(current.nodes[id]) === JSON.stringify(target.nodes[id]);
	const staleIds = Object.keys(current.nodes)
		.filter((id) => !same(id))
		.map((id) => new Types.ObjectId(id));
	await CollectionNodeModel.deleteMany(
		{ collectionId, _id: { $in: staleIds } },
		{ session },
	);
	const fresh = nodes.filter((node) => !same(node.id));
	// A merge can put together a request larger than an edit may write.
	for (const node of fresh) assertNodeSize(node);
	if (fresh.length > 0) {
		const docs = fresh.map((node) => storedNodeOf(node, collectionId, sub));
		await CollectionNodeModel.insertMany(docs, { session });
	}
	return revision.partial;
}
