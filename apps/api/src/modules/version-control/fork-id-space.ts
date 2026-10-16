import type { CollectionNode } from "@localman/shared/api-client";
import type { CollectionState } from "../collections/revision-patch.js";
import type { IdPair } from "./fork-model.js";

/**
 * A collection state with its node ids (keys, `id`, `parentId`) renamed.
 * Merges run in the source's id space: fork nodes take the id of the
 * source node they stand for, nodes only the fork has keep their own.
 */
export function renameState(
	state: CollectionState,
	rename: (id: string) => string,
): CollectionState {
	const nodes: Record<string, CollectionNode> = {};
	for (const node of Object.values(state.nodes)) {
		const id = rename(node.id);
		nodes[id] =
			node.parentId === null
				? { ...node, id }
				: ({ ...node, id, parentId: rename(node.parentId) } as CollectionNode);
	}
	return { root: state.root, nodes };
}

/** Fork id to source id, and back. */
export function pairMaps(pairs: readonly IdPair[]): {
	toSource: Map<string, string>;
	toFork: Map<string, string>;
} {
	return {
		toSource: new Map(pairs.map((pair) => [pair.f, pair.s])),
		toFork: new Map(pairs.map((pair) => [pair.s, pair.f])),
	};
}

/**
 * Gives a new id (from `fresh`) to every node whose id `keep` refuses —
 * nodes that came from the other side and do not exist here yet — and
 * returns the renamed state with the old id of each renamed node.
 */
export function allocateIds(
	state: CollectionState,
	keep: (id: string) => boolean,
	fresh: () => string,
): { state: CollectionState; renamed: Map<string, string> } {
	const renamed = new Map<string, string>();
	for (const id of Object.keys(state.nodes)) {
		if (!keep(id)) renamed.set(id, fresh());
	}
	return {
		state: renameState(state, (id) => renamed.get(id) ?? id),
		renamed,
	};
}
