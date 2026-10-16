import type { ClientSession } from "mongoose";
import {
	type CollectionAccess,
	requireCollection,
} from "../collections/collection-access.js";
import type { CollectionState } from "../collections/revision-patch.js";
import { loadState } from "../collections/revision-state.js";
import { loadBase } from "./collection-base.js";
import {
	requireForkPlan,
	requireLink,
	sourceUnavailable,
} from "./fork-access.js";
import { pairMaps, renameState } from "./fork-id-space.js";
import type { StoredFork } from "./fork-model.js";

export interface Sides {
	readonly fork: CollectionAccess;
	readonly source: CollectionAccess;
	readonly link: StoredFork;
}

export interface SyncStates {
	readonly base: CollectionState;
	readonly source: CollectionState;
	readonly fork: CollectionState;
	/** The fork with the ids of the source nodes its nodes stand for. */
	readonly forkInSource: CollectionState;
}

const isNotFound = (error: unknown): boolean =>
	error instanceof Error && "status" in error && error.status === 404;

/**
 * A collection fork (the caller needs `forkAction` on it), its link and
 * its source (`sourceAction`). Pro only. 404 `FORK_NOT_FOUND` when it is
 * not a fork, `FORK_SOURCE_UNAVAILABLE` when the source is gone or out of
 * the caller's reach.
 */
export async function sidesOf(
	sub: string,
	forkId: string,
	forkAction: "view" | "edit",
	sourceAction: "view" | "mergeFork",
): Promise<Sides> {
	const fork = await requireCollection(sub, forkId, forkAction);
	await requireForkPlan(sub);
	const link = await requireLink("collection", fork.collectionId);
	const source = await requireCollection(
		sub,
		link.sourceId.toHexString(),
		sourceAction,
	).catch((error: unknown) => {
		throw isNotFound(error) ? sourceUnavailable() : error;
	});
	return { fork, source, link };
}

/** Both sides and their base, read in `session` when given. */
export async function statesOf(
	sides: Sides,
	session?: ClientSession,
): Promise<SyncStates> {
	const [base, source, fork] = await Promise.all([
		loadBase(sides.link, session),
		loadState(sides.source.collectionId, session),
		loadState(sides.fork.collectionId, session),
	]);
	const { toSource } = pairMaps(sides.link.pairs);
	const forkInSource = renameState(fork, (id) => toSource.get(id) ?? id);
	return { base, source, fork, forkInSource };
}
