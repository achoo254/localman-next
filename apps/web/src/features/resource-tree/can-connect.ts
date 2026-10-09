import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import type { TreeItem } from "./tree-layout";

/**
 * Why the selected resource cannot be nested under a target (`null` = the
 * root). Mirrors the API's attach rules so the canvas can refuse before a
 * request; the API stays the authority.
 */
export type ConnectProblem =
	| "missing"
	| "self"
	| "already-there"
	| "cycle"
	| "name-taken"
	| "too-deep";

function descendantIds(items: readonly TreeItem[], id: string): Set<string> {
	const found = new Set<string>();
	const stack = [id];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const item of items) {
			if (item.parentId === current && !found.has(item.id)) {
				found.add(item.id);
				stack.push(item.id);
			}
		}
	}
	return found;
}

/** Levels from the root down to `id` (a root is level 1). */
function levelOf(items: readonly TreeItem[], id: string): number {
	const byId = new Map(items.map((item) => [item.id, item]));
	let level = 0;
	let current = byId.get(id);
	const seen = new Set<string>();
	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		level += 1;
		current =
			current.parentId === null ? undefined : byId.get(current.parentId);
	}
	return level;
}

/** Levels of the subtree rooted at `id`, itself included. */
function subtreeHeight(items: readonly TreeItem[], id: string): number {
	const children = items.filter((item) => item.parentId === id);
	return 1 + Math.max(0, ...children.map((c) => subtreeHeight(items, c.id)));
}

export function connectProblem(
	items: readonly TreeItem[],
	movingId: string,
	targetId: string | null,
): ConnectProblem | null {
	const moving = items.find((item) => item.id === movingId);
	if (!moving) return "missing";
	if (targetId !== null && !items.some((item) => item.id === targetId)) {
		return "missing";
	}
	if (targetId === movingId) return "self";
	if (moving.parentId === targetId) return "already-there";
	if (targetId !== null && descendantIds(items, movingId).has(targetId)) {
		return "cycle";
	}
	const clash = items.some(
		(item) =>
			item.id !== movingId &&
			item.parentId === targetId &&
			item.name === moving.name,
	);
	if (clash) return "name-taken";
	const above = targetId === null ? 0 : levelOf(items, targetId);
	if (above + subtreeHeight(items, movingId) > MAX_RESOURCE_DEPTH) {
		return "too-deep";
	}
	return null;
}

export function canConnect(
	items: readonly TreeItem[],
	movingId: string,
	targetId: string | null,
): boolean {
	return connectProblem(items, movingId, targetId) === null;
}

/** Sentence explaining a refused move, for the toast. */
export function connectProblemMessage(
	problem: ConnectProblem,
	moving: string,
	target: string | null,
	t: Translate,
): string {
	switch (problem) {
		case "missing":
			return t("resourceTree.refuse.missing");
		case "self":
			return t("resourceTree.refuse.self", { moving });
		case "already-there":
			return target === null
				? t("resourceTree.refuse.alreadyRoot", { moving })
				: t("resourceTree.refuse.alreadyIn", { moving, target });
		case "cycle":
			return t("resourceTree.refuse.cycle", {
				moving,
				target: target ?? "root",
			});
		case "name-taken":
			return t("resourceTree.refuse.nameTaken", { moving });
		case "too-deep":
			return t("resourceTree.refuse.tooDeep", { max: MAX_RESOURCE_DEPTH });
	}
}
