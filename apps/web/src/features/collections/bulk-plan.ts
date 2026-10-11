import type { CollectionSummary } from "@localman/shared/api-client";
import type { TreeRow } from "./tree-rows";

export interface BulkPlan {
	/** Whole collections: to the trash together. */
	collections: CollectionSummary[];
	/** Folders, requests and examples by collection, in selection order. */
	nodes: Map<string, string[]>;
	/** Items the user picked that will go (nodes of a picked collection go with it). */
	total: number;
}

/**
 * What deleting the selected rows does: picked collections go to the
 * trash; picked nodes of other collections are deleted, one call per
 * collection. A node whose collection is picked too is left to it.
 */
export function planBulkDelete(rows: readonly TreeRow[]): BulkPlan {
	const collections = rows.flatMap((row) =>
		row.kind === "collection" ? [row.summary] : [],
	);
	const whole = new Set(collections.map((item) => item.id));
	const nodes = new Map<string, string[]>();
	for (const row of rows) {
		if (row.kind === "collection" || whole.has(row.collectionId)) continue;
		const ids = nodes.get(row.collectionId) ?? [];
		ids.push(row.id);
		nodes.set(row.collectionId, ids);
	}
	const nodeCount = [...nodes.values()].reduce(
		(sum, ids) => sum + ids.length,
		0,
	);
	return { collections, nodes, total: collections.length + nodeCount };
}

/** Rows between `from` and `to` (both included), in tree order. */
export function rowRange(
	rows: readonly TreeRow[],
	from: string,
	to: string,
): string[] {
	const a = rows.findIndex((row) => row.id === from);
	const b = rows.findIndex((row) => row.id === to);
	if (a === -1 || b === -1) return [to];
	const [start, end] = a <= b ? [a, b] : [b, a];
	return rows.slice(start, end + 1).map((row) => row.id);
}
