import type { ConflictSide, MergePreview } from "@localman/shared/api-client";
import { writeCollectionState } from "../collections/collection-state-write.js";
import { newNodeId } from "../collections/collection-store.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { prunePairs, saveBase } from "./collection-base.js";
import { mergeCollections } from "./collection-merge.js";
import { sidesOf, statesOf } from "./collection-sync.js";
import { conflictsLeft, requireLink } from "./fork-access.js";
import { allocateIds, pairMaps, renameState } from "./fork-id-space.js";
import { mergePreview } from "./merge-views.js";

/** What pulling the source's changes would do to the fork (its Editors). */
export async function previewPull(
	sub: string,
	forkId: string,
): Promise<MergePreview> {
	const sides = await sidesOf(sub, forkId, "edit", "view");
	const states = await statesOf(sides);
	const merge = mergeCollections(
		states.base,
		states.source,
		states.forkInSource,
	);
	return mergePreview(
		{
			base: states.base,
			source: states.source,
			destination: states.forkInSource,
			merged: merge.state,
		},
		merge.conflicts,
	);
}

/**
 * Pulls the source's changes into the fork (its Editors), with a choice
 * for every conflict (409 `MERGE_CONFLICTS` otherwise), as one `pull`
 * change of the fork. Source nodes new to the fork get fork ids and pairs;
 * the source becomes the new base.
 */
export async function applyPull(
	sub: string,
	forkId: string,
	resolutions: Readonly<Record<string, ConflictSide>>,
): Promise<void> {
	const sides = await sidesOf(sub, forkId, "edit", "view");
	await inWorkspaceTransaction(
		sides.fork.element.workspaceId,
		async (session) => {
			// The link as of this transaction: another pull may have run since.
			const link = await requireLink(
				"collection",
				sides.fork.collectionId,
				session,
			);
			const states = await statesOf({ ...sides, link }, session);
			const merge = mergeCollections(
				states.base,
				states.source,
				states.forkInSource,
				resolutions,
			);
			if (merge.unresolved.length > 0) throw conflictsLeft(merge.unresolved);
			const { toFork } = pairMaps(link.pairs);
			const { state, renamed } = allocateIds(
				renameState(merge.state, (id) => toFork.get(id) ?? id),
				(id) => id in states.fork.nodes,
				newNodeId,
			);
			await writeCollectionState(
				sides.fork.collectionId,
				sub,
				session,
				{ current: states.fork, target: state },
				{
					action: "pull",
					entityName: sides.source.element.name,
					dryRun: false,
				},
			);
			const pairs = prunePairs(
				link.pairs,
				new Set(Object.keys(states.source.nodes)),
				new Set(Object.keys(state.nodes)),
				[...renamed].map(([s, f]) => ({ s, f })),
			);
			await saveBase(link._id, states.source, pairs, session);
		},
	);
}
