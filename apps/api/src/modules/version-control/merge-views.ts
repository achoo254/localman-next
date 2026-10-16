import type {
	CollectionNode,
	MergeChange,
	MergeConflictView,
	MergePreview,
} from "@localman/shared/api-client";
import type { CollectionState } from "../collections/revision-patch.js";
import { ROOT_KEY } from "./collection-merge.js";
import { type MergeConflict, sameContent } from "./three-way-merge.js";

/** What the destination becomes: added, removed and changed items. */
function changesOf(
	destination: CollectionState,
	merged: CollectionState,
): MergeChange[] {
	const changes: MergeChange[] = [];
	if (!sameContent(destination.root, merged.root)) {
		changes.push({
			kind: "changed",
			entityKind: "collection",
			name: merged.root.name,
		});
	}
	const ids = new Set([
		...Object.keys(destination.nodes),
		...Object.keys(merged.nodes),
	]);
	for (const id of ids) {
		const before = destination.nodes[id];
		const after = merged.nodes[id];
		if (sameContent(before, after)) continue;
		const node = (after ?? before) as CollectionNode;
		const kind = !before ? "added" : !after ? "removed" : "changed";
		changes.push({ kind, entityKind: node.kind, name: node.name });
	}
	return changes;
}

function conflictView(
	conflict: MergeConflict,
	states: readonly CollectionState[],
): MergeConflictView {
	const { id, key, path, base, source, destination } = conflict;
	if (key === ROOT_KEY) {
		const root = states[0]?.root;
		return {
			id,
			entityKind: "collection",
			name: root?.name ?? "",
			path,
			base,
			source,
			destination,
		};
	}
	const node = states
		.map((state) => state.nodes[key])
		.find((item) => item !== undefined);
	return {
		id,
		entityKind: node?.kind ?? "request",
		name: node?.name ?? "",
		path,
		base,
		source,
		destination,
	};
}

/** The preview of a pull or merge: changes on the destination, conflicts. */
export function mergePreview(
	states: {
		base: CollectionState;
		source: CollectionState;
		destination: CollectionState;
		merged: CollectionState;
	},
	conflicts: readonly MergeConflict[],
): MergePreview {
	const all = [states.source, states.destination, states.base];
	return {
		changes: changesOf(states.destination, states.merged),
		conflicts: conflicts.map((conflict) => conflictView(conflict, all)),
	};
}
