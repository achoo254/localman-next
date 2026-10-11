import type { OpenNode } from "./open-node";
import type { TreeRow } from "./tree-rows";
import type { DetailState } from "./use-collections";

/** Opens what a tree row shows (a request needs its loaded collection). */
export function openRow(
	row: TreeRow,
	details: ReadonlyMap<string, DetailState>,
	onOpenNode: OpenNode,
): void {
	if (row.kind === "request") {
		const item = details.get(row.collectionId);
		if (item?.status === "ready") {
			onOpenNode({ kind: "request", collection: item.detail, node: row.node });
		}
		return;
	}
	onOpenNode(
		row.kind === "collection"
			? { kind: "collection", collectionId: row.id, name: row.name }
			: {
					kind: row.kind,
					collectionId: row.collectionId,
					nodeId: row.id,
					name: row.name,
				},
	);
}

/** How a click picks rows: plain, Ctrl/Cmd (one more) or Shift (a range). */
export type PickMode = "open" | "toggle" | "range";

export function pickMode(event: {
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}): PickMode {
	if (event.shiftKey) return "range";
	return event.ctrlKey || event.metaKey ? "toggle" : "open";
}
