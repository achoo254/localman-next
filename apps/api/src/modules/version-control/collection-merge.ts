import type {
	CollectionNode,
	CollectionRootFields,
} from "@localman/shared/api-client";
import type { CollectionState } from "../collections/revision-patch.js";
import {
	type MergeConflict,
	type MergeSide,
	mergeEntities,
} from "./three-way-merge.js";

/** Key of the collection's own fields among the merged entities. */
export const ROOT_KEY = "collection";
/** Request, example and folder parts merged field by field. */
const NESTED = new Set(["draft", "request", "response", "scripts", "auth"]);

type NodeFields = Record<string, unknown>;

export interface CollectionMerge {
	readonly state: CollectionState;
	readonly conflicts: readonly MergeConflict[];
	readonly unresolved: readonly string[];
}

function fieldsOf(
	nodes: Readonly<Record<string, CollectionNode>>,
): Record<string, NodeFields> {
	const out: Record<string, NodeFields> = {};
	for (const [key, node] of Object.entries(nodes)) {
		const { id: _id, ...fields } = node;
		out[key] = fields;
	}
	return out;
}

/**
 * Makes the merged tree whole: a node whose folder is gone moves to the
 * top, an example whose request is gone goes too, and moves made on both
 * sides that close a loop are broken by moving a node of the loop to the
 * top. Sibling order needs no fix: keys are compared, then ids.
 */
export function wholeTree(
	nodes: Record<string, CollectionNode>,
): Record<string, CollectionNode> {
	const out: Record<string, CollectionNode> = {};
	for (const [id, node] of Object.entries(nodes)) {
		const parent = node.parentId === null ? undefined : nodes[node.parentId];
		if (node.kind === "example") {
			if (parent?.kind === "request") out[id] = node;
		} else if (node.parentId !== null && parent?.kind !== "folder") {
			out[id] = { ...node, parentId: null };
		} else {
			out[id] = node;
		}
	}
	for (const id of Object.keys(out)) {
		const seen = new Set<string>([id]);
		let at = out[id]?.parentId ?? null;
		while (at !== null) {
			if (seen.has(at)) {
				const node = out[id];
				if (node && node.kind !== "example")
					out[id] = { ...node, parentId: null };
				break;
			}
			seen.add(at);
			at = out[at]?.parentId ?? null;
		}
	}
	return out;
}

/**
 * Merges `source` into `destination` against `base`, all three in the
 * same id space: the collection's own fields as one entity, every node by
 * id. Clashing sibling orders take the source's. Unresolved conflicts
 * leave the destination's value in `state`.
 */
export function mergeCollections(
	base: CollectionState,
	source: CollectionState,
	destination: CollectionState,
	resolutions: Readonly<Record<string, MergeSide>> = {},
): CollectionMerge {
	const options = {
		nested: NESTED,
		sourceWins: new Set(["order"]),
		resolutions,
	};
	const root = mergeEntities(
		{ [ROOT_KEY]: base.root as unknown as NodeFields },
		{ [ROOT_KEY]: source.root as unknown as NodeFields },
		{ [ROOT_KEY]: destination.root as unknown as NodeFields },
		options,
	);
	const nodes = mergeEntities(
		fieldsOf(base.nodes),
		fieldsOf(source.nodes),
		fieldsOf(destination.nodes),
		options,
	);
	const merged: Record<string, CollectionNode> = {};
	for (const [id, fields] of Object.entries(nodes.result)) {
		merged[id] = { ...fields, id } as unknown as CollectionNode;
	}
	return {
		state: {
			root: (root.result[ROOT_KEY] ??
				destination.root) as unknown as CollectionRootFields,
			nodes: wholeTree(merged),
		},
		conflicts: [...root.conflicts, ...nodes.conflicts],
		unresolved: [...root.unresolved, ...nodes.unresolved],
	};
}
