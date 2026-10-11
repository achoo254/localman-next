import type { ClientSession, Types } from "mongoose";
import { Types as MongoTypes } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { nodeBytes } from "./collection-bytes.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import { toCollectionNode } from "./collection-view.js";
import {
	type KindCounts,
	type Outline,
	countKinds,
	loadOutline,
	pathToTop,
	subtreeIds,
} from "./node-outline.js";
import { nodeNotFound } from "./node-service.js";
import { nodesRevision } from "./revision-drafts.js";
import { buildRevision, isIrreversible } from "./revision-patch.js";
import { chargeRoot } from "./root-change.js";

export interface NodeDeletion extends KindCounts {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	/**
	 * The deletion is too large to keep its diff: it cannot be undone and
	 * blocks restoring older changes.
	 */
	readonly irreversible: boolean;
}

/** Listed ids that no other listed id holds in its subtree. */
function topmost(outline: Outline, ids: readonly string[]): string[] {
	const listed = new Set(ids);
	return [...listed].filter((id) =>
		pathToTop(outline, id)
			.slice(1)
			.every((above) => !listed.has(above)),
	);
}

/**
 * Deletes the nodes `rootIds` with everything under them in the caller's
 * transaction (all of them, or 404 `NODE_NOT_FOUND` and nothing): one
 * changelog entry per deleted subtree. A dry run counts and checks
 * whether the entries would keep their patches, without writing.
 */
async function deleteSubtrees(
	collectionId: Types.ObjectId,
	sub: string,
	session: ClientSession,
	rootIds: readonly string[],
	dryRun: boolean,
): Promise<KindCounts & { irreversible: boolean }> {
	const outline = await loadOutline(collectionId, session);
	if (rootIds.some((id) => !outline.has(id))) throw nodeNotFound();
	const subtrees = topmost(outline, rootIds).map((id) =>
		subtreeIds(outline, id),
	);
	const all = subtrees.flat();
	const counts = countKinds(outline, all);
	const docs = await CollectionNodeModel.find({
		collectionId,
		_id: { $in: all.map((at) => new MongoTypes.ObjectId(at)) },
	})
		.session(session)
		.lean<StoredCollectionNode[]>();
	const byId = new Map(
		docs.map((doc) => [doc._id.toHexString(), toCollectionNode(doc)]),
	);
	const revisions = subtrees.flatMap((ids) => {
		const nodes = ids.flatMap((at) => byId.get(at) ?? []);
		const [top] = nodes;
		return top ? [buildRevision(nodesRevision("delete", top, nodes, []))] : [];
	});
	const irreversible = isIrreversible(revisions);
	if (dryRun) return { ...counts, irreversible };
	await chargeRoot(collectionId, sub, session, {
		bytes: -docs.reduce((sum, doc) => sum + nodeBytes(doc), 0),
		requests: -counts.requests,
		revisions,
	});
	await CollectionNodeModel.deleteMany(
		{ collectionId, _id: { $in: docs.map((doc) => doc._id) } },
		{ session },
	);
	return { ...counts, irreversible };
}

/**
 * Deletes nodes of one collection with their subtrees (Editor), in one
 * transaction under the workspace lock; a dry run counts what would go.
 */
export async function deleteNodes(
	sub: string,
	id: string,
	nodeIds: readonly string[],
	dryRun: boolean,
): Promise<NodeDeletion> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const counts = await inWorkspaceTransaction(element.workspaceId, (session) =>
		deleteSubtrees(collectionId, sub, session, nodeIds, dryRun),
	);
	return { dryRun, deleted: !dryRun, ...counts };
}
