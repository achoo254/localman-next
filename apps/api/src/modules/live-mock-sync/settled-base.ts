import type { CollectionNode } from "@localman/shared/api-client";
import type { MergeConflict } from "../version-control/three-way-merge.js";
import type { MockNodes } from "./mock-to-collection-mapper.js";

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** `entity` with the field at `path` (`draft` or `draft.url`) set back to `value`. */
function withField(entity: CollectionNode, path: string, value: unknown) {
	const [top = "", inner] = path.split(".");
	const copy: Fields = { ...entity };
	if (inner === undefined) {
		if (value === undefined) delete copy[top];
		else copy[top] = value;
		return copy as unknown as CollectionNode;
	}
	const nested: Fields = isFields(copy[top]) ? { ...copy[top] } : {};
	if (value === undefined) delete nested[inner];
	else nested[inner] = value;
	copy[top] = nested;
	return copy as unknown as CollectionNode;
}

/**
 * The base the next sync compares against: what the mock gives now, so
 * what was applied counts as agreed (a node the user deletes stays
 * deleted, a field they edit back is theirs), except where a clash still
 * waits for a choice, which keeps its old base value so it shows again.
 */
export function settledBase(
	base: MockNodes,
	theirs: MockNodes,
	open: readonly MergeConflict[],
): MockNodes {
	const next: MockNodes = { ...theirs };
	for (const conflict of open) {
		if (conflict.path === "") {
			const before = base[conflict.key];
			if (before) next[conflict.key] = before;
			else delete next[conflict.key];
			continue;
		}
		const entity = next[conflict.key];
		if (entity)
			next[conflict.key] = withField(entity, conflict.path, conflict.base);
	}
	return next;
}
