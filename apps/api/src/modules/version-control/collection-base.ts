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
 * The pairs after a pull or merge: those whose source or fork node still
 * exists, with `added` replacing any pair that named the same source or
 * fork node (a node brought back after one side deleted it gets a new id
 * on that side, and its old pair must go).
 */
export function prunePairs(
	pairs: readonly IdPair[],
	sourceIds: ReadonlySet<string>,
	forkIds: ReadonlySet<string>,
	added: readonly IdPair[] = [],
): IdPair[] {
	const takenS = new Set(added.map((pair) => pair.s));
	const takenF = new Set(added.map((pair) => pair.f));
	return [
		...pairs.filter(
			(pair) =>
				!takenS.has(pair.s) &&
				!takenF.has(pair.f) &&
				(sourceIds.has(pair.s) || forkIds.has(pair.f)),
		),
		...added,
	];
}
