/**
 * Drag and drop in the collections tree (pure): where on a row a drop
 * lands, and the move it asks the API for (new parent and the order keys
 * of the neighbours around the drop). Drops stay inside one collection;
 * a folder never goes into itself or a folder below it.
 */
import {
	type CollectionNode,
	childrenByParent,
	orderKeyBetween,
} from "@localman/shared/api-client";
import type { NodeMove } from "./nodes-api";

export type DropPosition = "before" | "after" | "inside";

export type DropTargetKind = "collection" | "folder" | "request" | "example";

/**
 * Position of a drop at height `y` over a row: a collection only takes
 * items inside (at the end); a folder has a middle band for "inside";
 * a request splits in two halves.
 */
export function dropPositionAt(
	kind: DropTargetKind,
	y: number,
	rect: { top: number; height: number },
): DropPosition {
	if (kind === "collection") return "inside";
	const ratio = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
	if (kind === "folder") {
		if (ratio < 0.25) return "before";
		return ratio > 0.75 ? "after" : "inside";
	}
	return ratio < 0.5 ? "before" : "after";
}

/** Whether `nodeId` is `rootId` or lies below it. */
export function isInSubtree(
	nodes: readonly CollectionNode[],
	rootId: string,
	nodeId: string,
): boolean {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const seen = new Set<string>();
	let current: string | null = nodeId;
	while (current !== null && !seen.has(current)) {
		if (current === rootId) return true;
		seen.add(current);
		current = byId.get(current)?.parentId ?? null;
	}
	return false;
}

/** `rootId` and the ids of every node below it. */
export function subtreeIds(
	nodes: readonly CollectionNode[],
	rootId: string,
): Set<string> {
	const byParent = childrenByParent(nodes);
	const ids = new Set<string>();
	const stack = [rootId];
	for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
		if (ids.has(id)) continue;
		ids.add(id);
		for (const child of byParent.get(id) ?? []) stack.push(child.id);
	}
	return ids;
}

/** The row dropped on: the collection itself or one of its nodes. */
export type DropTarget =
	| { kind: "collection" }
	| {
			kind: "node";
			nodeId: string;
			/** An expanded folder: "after" lands as its first child. */
			expanded: boolean;
	  };

type Slot =
	| { parentId: string | null; at: "start" | "end" }
	| { parentId: string | null; at: "before" | "after"; siblingId: string };

function slotOf(
	nodes: readonly CollectionNode[],
	target: DropTarget,
	position: DropPosition,
): Slot | null {
	if (target.kind === "collection") return { parentId: null, at: "end" };
	const node = nodes.find((item) => item.id === target.nodeId);
	if (!node) return null;
	if (position === "inside") {
		return node.kind === "folder" ? { parentId: node.id, at: "end" } : null;
	}
	const hasChildren = nodes.some((item) => item.parentId === node.id);
	if (position === "after" && node.kind === "folder" && target.expanded) {
		if (hasChildren) return { parentId: node.id, at: "start" };
	}
	return { parentId: node.parentId, at: position, siblingId: node.id };
}

/**
 * The move for dropping `draggedId` on `target`, or `null` when the drop is
 * not allowed (into its own subtree, inside a request) or changes nothing.
 */
export function planMove(
	nodes: readonly CollectionNode[],
	draggedId: string,
	target: DropTarget,
	position: DropPosition,
): NodeMove | null {
	const dragged = nodes.find((node) => node.id === draggedId);
	if (!dragged) return null;
	if (target.kind === "node" && target.nodeId === draggedId) return null;
	// Examples stay under their request, and nothing drops among them.
	if (dragged.kind === "example") return null;
	if (
		target.kind === "node" &&
		nodes.find((node) => node.id === target.nodeId)?.kind === "example"
	) {
		return null;
	}
	const slot = slotOf(nodes, target, position);
	if (!slot) return null;
	if (slot.parentId !== null && isInSubtree(nodes, draggedId, slot.parentId)) {
		return null;
	}
	const original = childrenByParent(nodes).get(slot.parentId) ?? [];
	const siblings = original.filter((node) => node.id !== draggedId);
	let index = slot.at === "start" ? 0 : siblings.length;
	if (slot.at === "before" || slot.at === "after") {
		const at = siblings.findIndex((node) => node.id === slot.siblingId);
		if (at === -1) return null;
		index = slot.at === "before" ? at : at + 1;
	}
	const before = siblings[index - 1] ?? null;
	const after = siblings[index] ?? null;
	if (dragged.parentId === slot.parentId) {
		const was = original.findIndex((node) => node.id === draggedId);
		const prev = original[was - 1] ?? null;
		const next = original[was + 1] ?? null;
		if (prev?.id === before?.id && next?.id === after?.id) return null;
	}
	return {
		parentId: slot.parentId,
		beforeOrder: before?.order ?? null,
		afterOrder: after?.order ?? null,
	};
}

/** The nodes as they will be once the API applies `move` (optimistic view). */
export function applyMove(
	nodes: readonly CollectionNode[],
	nodeId: string,
	move: NodeMove,
): CollectionNode[] {
	let order: string;
	try {
		order = orderKeyBetween(move.beforeOrder, move.afterOrder);
	} catch {
		return [...nodes];
	}
	return nodes.map((node) =>
		node.id === nodeId && node.kind !== "example"
			? { ...node, parentId: move.parentId, order }
			: node,
	);
}
