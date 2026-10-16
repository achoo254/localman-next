import { OperationError } from "@localman/operations";
import type {
	CollectionDetail,
	ForkListItem,
	ForkStatus,
} from "@localman/shared/api-client";
import { requireCollection } from "../collections/collection-access.js";
import { withNewIds } from "../collections/collection-duplicate-service.js";
import { insertCollection } from "../collections/collection-insert.js";
import { loadCollectionDetail } from "../collections/collection-store.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { saveBase } from "./collection-base.js";
import { requireForkPlan, requireForkTarget } from "./fork-access.js";
import { renameState } from "./fork-id-space.js";
import { forkStatusOf, forksOf } from "./fork-listing.js";
import { ForkModel } from "./fork-model.js";

/**
 * Forks a collection (Pro): a copy with new node ids in a workspace where
 * the caller adds elements, linked to its source with the pairs of ids and
 * the copied content as the base. A Viewer of the source may fork it into
 * their personal workspace only (403 `FORK_TARGET_NOT_ALLOWED`).
 */
export async function forkCollection(
	sub: string,
	id: string,
	input: { label: string; workspaceId: string },
): Promise<CollectionDetail> {
	const access = await requireCollection(sub, id, "fork");
	await requireForkPlan(sub);
	const workspace = await requireForkTarget(
		sub,
		access.role,
		input.workspaceId,
	);
	const source = await loadCollectionDetail(
		access.collectionId,
		access.role,
		sub,
	);
	const { nodes, ids } = withNewIds(source.nodes);
	const { name, description, auth, scripts, variables, tags, status } = source;
	const root = { name, description, auth, scripts, variables, tags, status };
	const pairs = [...ids].map(([s, f]) => ({ s, f }));
	const forkId = await inWorkspaceTransaction(
		workspace._id,
		async (session) => {
			const created = await insertCollection(
				{ workspaceId: workspace._id, root, nodes, sub },
				session,
			);
			const [link] = await ForkModel.create(
				[
					{
						kind: "collection",
						sourceId: access.collectionId,
						forkId: created,
						label: input.label,
						createdBy: sub,
						pairs,
						base: root,
					},
				],
				{ session },
			);
			const toSource = new Map(pairs.map((pair) => [pair.f, pair.s]));
			const base = renameState(
				{
					root,
					nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
				},
				(nodeId) => toSource.get(nodeId) ?? nodeId,
			);
			if (link) await saveBase(link._id, base, pairs, session);
			return created;
		},
	);
	return loadCollectionDetail(forkId, "editor", sub);
}

/** Whether the collection is a fork (and of what), and how many forks it has. */
export async function collectionForkStatus(
	sub: string,
	id: string,
): Promise<ForkStatus> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return forkStatusOf(sub, "collection", collectionId);
}

/** The forks of a collection, newest first; `canOpen` per fork. */
export async function listCollectionForks(
	sub: string,
	id: string,
): Promise<ForkListItem[]> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return forksOf(sub, "collection", collectionId);
}
