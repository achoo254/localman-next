/**
 * The sidebar tree as a flat list of visible rows (pure): collections in
 * the chosen order with favorites first, then each expanded collection's
 * folders and requests in their stored order. (Search is the server's:
 * `collection-search-results.tsx`.)
 */
import {
	type CollectionFolderNode,
	type CollectionNode,
	type CollectionRequestNode,
	type CollectionSummary,
	childrenByParent,
} from "@localman/shared/api-client";
import type { DetailState } from "./use-collections";

export const COLLECTION_SORTS = ["name-asc", "name-desc", "updated"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export function isCollectionSort(value: unknown): value is CollectionSort {
	return COLLECTION_SORTS.some((sort) => sort === value);
}

const NAME_ORDER = new Intl.Collator(undefined, {
	sensitivity: "base",
	numeric: true,
});

/** Favorites first, then by `sort`; ties by name, then id. */
export function sortCollections(
	list: readonly CollectionSummary[],
	sort: CollectionSort,
): CollectionSummary[] {
	return [...list].sort((a, b) => {
		if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
		let order = 0;
		if (sort === "updated") order = b.updatedAt.localeCompare(a.updatedAt);
		else if (sort === "name-desc") order = NAME_ORDER.compare(b.name, a.name);
		if (order === 0) order = NAME_ORDER.compare(a.name, b.name);
		return order !== 0 ? order : a.id.localeCompare(b.id);
	});
}

interface RowBase {
	/** Collection id for a collection row, node id otherwise. */
	id: string;
	collectionId: string;
	/** 0 for a collection. */
	depth: number;
	name: string;
}

export type TreeRow =
	| (RowBase & {
			kind: "collection";
			summary: CollectionSummary;
			expanded: boolean;
			/** Items of an expanded collection still loading or failed. */
			items: "loading" | "error" | "ready" | "closed";
	  })
	| (RowBase & {
			kind: "folder";
			node: CollectionFolderNode;
			expanded: boolean;
			hasChildren: boolean;
	  })
	| (RowBase & { kind: "request"; node: CollectionRequestNode });

export interface TreeRowsInput {
	collections: readonly CollectionSummary[];
	details: ReadonlyMap<string, DetailState>;
	/** Expanded collection and folder ids. */
	expanded: ReadonlySet<string>;
}

export function buildTreeRows({
	collections,
	details,
	expanded,
}: TreeRowsInput): TreeRow[] {
	const rows: TreeRow[] = [];
	for (const summary of collections) {
		const state = details.get(summary.id);
		const detail = state?.status === "ready" ? state.detail : null;
		const byParent = detail
			? childrenByParent(detail.nodes)
			: new Map<string | null, CollectionNode[]>();
		const open = expanded.has(summary.id);
		rows.push({
			kind: "collection",
			id: summary.id,
			collectionId: summary.id,
			depth: 0,
			name: summary.name,
			summary,
			expanded: open,
			items: open ? (state?.status ?? "loading") : "closed",
		});
		if (!open || !detail) continue;
		const visit = (parentId: string | null, depth: number): void => {
			for (const node of byParent.get(parentId) ?? []) {
				const base = { id: node.id, collectionId: summary.id, depth };
				if (node.kind === "request") {
					rows.push({ ...base, kind: "request", name: node.name, node });
					continue;
				}
				const folderOpen = expanded.has(node.id);
				rows.push({
					...base,
					kind: "folder",
					name: node.name,
					node,
					expanded: folderOpen,
					hasChildren: (byParent.get(node.id)?.length ?? 0) > 0,
				});
				if (folderOpen) visit(node.id, depth + 1);
			}
		};
		visit(null, 1);
	}
	return rows;
}

/** Row of the parent (collection or folder) of `row`, for ← in the tree. */
export function parentRowId(row: TreeRow): string | null {
	if (row.kind === "collection") return null;
	return row.node.parentId ?? row.collectionId;
}
