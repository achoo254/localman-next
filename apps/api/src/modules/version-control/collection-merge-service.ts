import type {
	ConflictSide,
	MergeOption,
	MergePreview,
} from "@localman/shared/api-client";
import type { ClientSession } from "mongoose";
import { writeCollectionState } from "../collections/collection-state-write.js";
import { newNodeId } from "../collections/collection-store.js";
import { trashCollection, trashable } from "../collections/trash-service.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { prunePairs, saveBase } from "./collection-base.js";
import { mergeCollections } from "./collection-merge.js";
import { applyPull } from "./collection-pull-service.js";
import { type Sides, sidesOf, statesOf } from "./collection-sync.js";
import { conflictsLeft, requireLink } from "./fork-access.js";
import { allocateIds, pairMaps, renameState } from "./fork-id-space.js";
import { type MergeFollowUp, followUp } from "./merge-follow-up.js";
import { mergePreview } from "./merge-views.js";

/** What merging the fork would do to its source (the source's Editors). */
export async function previewMerge(
	sub: string,
	forkId: string,
): Promise<MergePreview> {
	const sides = await sidesOf(sub, forkId, "view", "mergeFork");
	const states = await statesOf(sides);
	const merge = mergeCollections(
		states.base,
		states.forkInSource,
		states.source,
	);
	return mergePreview(
		{
			base: states.base,
			source: states.forkInSource,
			destination: states.source,
			merged: merge.state,
		},
		merge.conflicts,
	);
}

/**
 * Merges the fork's changes into its source (Editors of the source; the
 * two other options need Editor on the fork too), with a choice for every
 * conflict, as one `merge` change of the source. Fork nodes new to the
 * source get source ids and pairs; the fork becomes the new base. Then
 * `mergeAndUpdate` pulls the merged source back into the fork, and
 * `mergeAndDelete` moves the fork to the trash.
 *
 * A pull request passes `through`: its sides, already checked (a plain
 * merge need not open the fork), and a write that commits with the merge.
 */
export async function applyMerge(
	sub: string,
	forkId: string,
	option: MergeOption,
	resolutions: Readonly<Record<string, ConflictSide>>,
	through?: {
		sides?: Sides;
		alongside: (session: ClientSession) => Promise<void>;
	},
): Promise<MergeFollowUp> {
	const forkAction = option === "merge" ? "view" : "edit";
	const sides =
		through?.sides ?? (await sidesOf(sub, forkId, forkAction, "mergeFork"));
	// Refuse before merging when the fork could not be deleted afterwards.
	if (option === "mergeAndDelete") await trashable(sub, forkId);
	await inWorkspaceTransaction(
		sides.source.element.workspaceId,
		async (session) => {
			const link = await requireLink(
				"collection",
				sides.fork.collectionId,
				session,
			);
			const states = await statesOf({ ...sides, link }, session);
			const merge = mergeCollections(
				states.base,
				states.forkInSource,
				states.source,
				resolutions,
			);
			if (merge.unresolved.length > 0) throw conflictsLeft(merge.unresolved);
			const { state, renamed } = allocateIds(
				merge.state,
				(id) => id in states.source.nodes,
				newNodeId,
			);
			await writeCollectionState(
				sides.source.collectionId,
				sub,
				session,
				{ current: states.source, target: state },
				{ action: "merge", entityName: link.label, dryRun: false },
			);
			// A renamed key is a source id for a node the source had deleted (the
			// fork's version came back), else a fork id new to the source.
			const { toFork } = pairMaps(link.pairs);
			const added = [...renamed].map(([key, s]) => ({
				s,
				f: toFork.get(key) ?? key,
			}));
			const pairs = prunePairs(
				link.pairs,
				new Set(Object.keys(state.nodes)),
				new Set(Object.keys(states.fork.nodes)),
				added,
			);
			const { toSource } = pairMaps(pairs);
			const base = renameState(states.fork, (id) => toSource.get(id) ?? id);
			await saveBase(link._id, base, pairs, session);
			await through?.alongside(session);
		},
	);
	return followUp(option, async () => {
		if (option === "mergeAndUpdate") await applyPull(sub, forkId, {});
		if (option === "mergeAndDelete") {
			await trashCollection(sub, forkId, "delete", false);
		}
	});
}
