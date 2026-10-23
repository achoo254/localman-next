import type { CollectionState } from "../collections/revision-patch.js";
import { mergeCollections } from "../version-control/collection-merge.js";
import { allocateIds, renameState } from "../version-control/fork-id-space.js";
import type {
	MergeConflict,
	MergeSide,
} from "../version-control/three-way-merge.js";
import type { MockNodes } from "./mock-to-collection-mapper.js";
import { withRemoved } from "./removed-nodes.js";
import { isMockKey } from "./sync-keys.js";
import type { SyncNames } from "./sync-names.js";

/** A node of the collection (`n`) and the mock key it stands for (`k`). */
export interface SyncPair {
	readonly k: string;
	readonly n: string;
}

export interface SyncInputs {
	/** What the last sync took from the mock (keys). */
	readonly base: MockNodes;
	/** What the mock gives now (keys). */
	readonly mapped: MockNodes;
	/** The collection as it is (node ids). */
	readonly collection: CollectionState;
	readonly pairs: readonly SyncPair[];
	readonly names: SyncNames;
	/** Choices for conflicts: `source` takes the mock's, `destination` keeps the collection's. */
	readonly resolutions?: Readonly<Record<string, MergeSide>>;
}

export interface SyncOutcome {
	/** The collection to write (node ids, new nodes with fresh ids). */
	readonly target: CollectionState;
	readonly pairs: SyncPair[];
	/** The mock side merged now: the next base once nothing is left open. */
	readonly theirs: MockNodes;
	/** In key space, for the preview. */
	readonly views: {
		readonly base: CollectionState;
		readonly theirs: CollectionState;
		readonly collection: CollectionState;
		readonly merged: CollectionState;
	};
	readonly conflicts: readonly MergeConflict[];
	readonly unresolved: readonly string[];
}

/**
 * Three-way merge of the mock's changes into the collection, in the
 * mock's key space: the base is what the last sync wrote, "theirs" what
 * the mock gives now, "ours" the collection with its synced nodes renamed
 * to their keys (the user's own nodes keep their ids). What the user
 * edited stays; a clash on the same field is a conflict and keeps the
 * user's value until resolved. The collection's own fields are not
 * synced.
 */
export function mergeMockChanges(
	inputs: SyncInputs,
	freshId: () => string,
): SyncOutcome {
	const toKey = new Map(inputs.pairs.map((pair) => [pair.n, pair.k]));
	const toNode = new Map(inputs.pairs.map((pair) => [pair.k, pair.n]));
	const ours = renameState(inputs.collection, (id) => toKey.get(id) ?? id);
	const theirs = withRemoved(
		inputs.base,
		inputs.mapped,
		(key) => key in ours.nodes,
		inputs.names,
	);
	const root = inputs.collection.root;
	const views = {
		base: { root, nodes: inputs.base },
		theirs: { root, nodes: theirs },
		collection: ours,
	};
	const merge = mergeCollections(
		views.base,
		views.theirs,
		views.collection,
		inputs.resolutions,
	);
	const known = renameState(merge.state, (key) => toNode.get(key) ?? key);
	// Mock keys left are nodes new to the collection.
	const { state, renamed } = allocateIds(
		known,
		(id) => !isMockKey(id),
		freshId,
	);
	const existing = new Set(Object.keys(state.nodes));
	const pairs = [
		...inputs.pairs.filter((pair) => existing.has(pair.n)),
		...[...renamed].map(([k, n]) => ({ k, n })),
	];
	return {
		target: state,
		pairs,
		theirs,
		views: { ...views, merged: merge.state },
		conflicts: merge.conflicts,
		unresolved: merge.unresolved,
	};
}
