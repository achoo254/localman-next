import {
	type CollectionNode,
	orderKeyBetween,
} from "@localman/shared/api-client";
import type { MockNodes } from "./mock-to-collection-mapper.js";
import { REMOVED_KEY, isMockKey } from "./sync-keys.js";
import type { SyncNames } from "./sync-names.js";

/** Name of the folder of removed requests (the same in every language). */
export const REMOVED_FOLDER_NAME = "_removed";

function lastTopOrder(nodes: MockNodes): string | null {
	let last: string | null = null;
	for (const node of Object.values(nodes)) {
		if (node.parentId === null && node.id !== REMOVED_KEY) {
			if (last === null || node.order > last) last = node.order;
		}
	}
	return last;
}

/**
 * What the mock side says now, with what it stopped serving kept: a
 * request or folder of the last sync that the mapper no longer gives (its
 * endpoint turned off, its resource deleted) moves into the `_removed`
 * folder instead of going away, as long as the collection still has it.
 * A folder's content moves along inside it; examples stay on their
 * request. Deleting a removed node in the collection lets it go for good.
 */
export function withRemoved(
	base: MockNodes,
	mapped: MockNodes,
	stillThere: (key: string) => boolean,
	names: SyncNames,
): MockNodes {
	const theirs: MockNodes = { ...mapped };
	const gone = (key: string): boolean =>
		key in base && !(key in mapped) && key !== REMOVED_KEY;
	let moved = false;
	for (const [key, node] of Object.entries(base)) {
		if (!isMockKey(key) || !gone(key) || !stillThere(key)) continue;
		const parentGone = node.parentId !== null && gone(node.parentId);
		if (node.kind === "example" || parentGone) {
			theirs[key] = node;
			continue;
		}
		theirs[key] = removedCopy(node, names.removedItem);
		moved = true;
	}
	if (moved || (REMOVED_KEY in base && stillThere(REMOVED_KEY))) {
		const kept = Object.values(theirs).some(
			(node) => node.parentId === REMOVED_KEY,
		);
		if (kept) theirs[REMOVED_KEY] = removedFolder(base, mapped, names);
	}
	return theirs;
}

function removedCopy(node: CollectionNode, note: string): CollectionNode {
	if (node.kind === "example") return node;
	return { ...node, parentId: REMOVED_KEY, description: note };
}

function removedFolder(
	base: MockNodes,
	mapped: MockNodes,
	names: SyncNames,
): CollectionNode {
	const known = base[REMOVED_KEY];
	if (known) return known;
	return {
		kind: "folder",
		id: REMOVED_KEY,
		parentId: null,
		order: orderKeyBetween(lastTopOrder(mapped), null),
		name: REMOVED_FOLDER_NAME,
		description: names.removedFolder,
		auth: { type: "inherit" },
		scripts: { pre: "", post: "" },
	};
}
