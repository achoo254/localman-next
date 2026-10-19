import type { MergePreview } from "@localman/shared/api-client";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { elementAdapter } from "../access/element-adapters.js";
import type { CollectionAccess } from "../collections/collection-access.js";
import { mergeCollections } from "./collection-merge.js";
import { type Sides, statesOf } from "./collection-sync.js";
import { findLink } from "./fork-access.js";
import { mergePreview } from "./merge-views.js";
import type { StoredPullRequest } from "./pull-request-model.js";

/**
 * The fork and source of a pull request, for someone who can open the
 * source: the author offered the fork's content for review, so the fork
 * itself need not be open to them (it stands in with a Viewer's role).
 * `null` when the fork is gone or no longer a fork of this source. Takes a
 * `sync` slot of the source, never of the fork.
 */
export async function pullRequestSides(
	sub: string,
	pr: StoredPullRequest,
	source: CollectionAccess,
): Promise<Sides | null> {
	const link = await findLink("collection", pr.forkId);
	if (!link?.sourceId.equals(pr.sourceId)) return null;
	const element = await elementAdapter("collection")?.load(
		pr.forkId.toHexString(),
	);
	if (!element) return null;
	await takeOperationSlot("sync", sub, source.element.id);
	return {
		fork: { element, collectionId: pr.forkId, role: "viewer" },
		source,
		link,
	};
}

/**
 * The states of a live pull request and the merge it would make now.
 * `null` once merged or declined, or when the fork is gone.
 */
export async function liveMerge(
	sub: string,
	pr: StoredPullRequest,
	source: CollectionAccess,
) {
	if (pr.status === "merged" || pr.status === "declined") return null;
	const sides = await pullRequestSides(sub, pr, source);
	if (!sides) return null;
	const states = await statesOf(sides);
	const merge = mergeCollections(
		states.base,
		states.forkInSource,
		states.source,
	);
	return { states, merge };
}

/** Its changes as a merge would make them now; `null` as for `liveMerge`. */
export async function livePreview(
	sub: string,
	pr: StoredPullRequest,
	source: CollectionAccess,
): Promise<MergePreview | null> {
	const live = await liveMerge(sub, pr, source);
	if (!live) return null;
	return mergePreview(
		{
			base: live.states.base,
			source: live.states.forkInSource,
			destination: live.states.source,
			merged: live.merge.state,
		},
		live.merge.conflicts,
	);
}
