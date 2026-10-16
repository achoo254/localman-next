import type {
	CollectionNode,
	CollectionRootFields,
} from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import type { CollectionState } from "../collections/revision-patch.js";
import {
	ForkBaseNodeModel,
	ForkModel,
	type IdPair,
	type StoredFork,
} from "./fork-model.js";

/** The common ancestor of a collection fork, in the source's id space. */
export async function loadBase(
	link: StoredFork,
	session?: ClientSession,
): Promise<CollectionState> {
	const rows = await ForkBaseNodeModel.find({ linkId: link._id })
		.session(session ?? null)
		.lean<{ key: string; node: CollectionNode }[]>();
	return {
		root: link.base as CollectionRootFields,
		nodes: Object.fromEntries(rows.map((row) => [row.key, row.node])),
	};
}

/** Replaces the base (and the id pairs) of a collection fork. */
export async function saveBase(
	linkId: Types.ObjectId,
	base: CollectionState,
	pairs: readonly IdPair[],
	session: ClientSession,
): Promise<void> {
	await ForkModel.updateOne(
		{ _id: linkId },
		{ $set: { base: base.root, pairs } },
		{ session },
	);
	await ForkBaseNodeModel.deleteMany({ linkId }, { session });
	const docs = Object.entries(base.nodes).map(([key, node]) => ({
		linkId,
		key,
		node,
	}));
	if (docs.length > 0) await ForkBaseNodeModel.insertMany(docs, { session });
}

/**
 * Pairs still worth keeping: those whose source or fork node exists.
 * New ones (from a merge or pull) come after.
 */
export function prunePairs(
	pairs: readonly IdPair[],
	sourceIds: ReadonlySet<string>,
	forkIds: ReadonlySet<string>,
	added: readonly IdPair[] = [],
): IdPair[] {
	return [
		...pairs.filter((pair) => sourceIds.has(pair.s) || forkIds.has(pair.f)),
		...added,
	];
}
