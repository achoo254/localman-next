/**
 * Query keys and reads of collections. The sidebar list holds summaries;
 * a collection's folders and requests load when it is expanded (or
 * searched), and round 2's collection tabs read the same detail entry.
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import {
	type UseQueryResult,
	useQueries,
	useQuery,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchCollection, fetchCollections } from "./collections-api";

export const COLLECTIONS_KEY = ["collections"] as const;
export const collectionListKey = (workspaceId: string) =>
	[...COLLECTIONS_KEY, "list", workspaceId] as const;
export const collectionKey = (collectionId: string) =>
	[...COLLECTIONS_KEY, "detail", collectionId] as const;
export const TRASH_KEY = [...COLLECTIONS_KEY, "trash"] as const;

const STALE_MS = 15_000;

export function useCollectionList(workspaceId: string | null) {
	return useQuery({
		queryKey: collectionListKey(workspaceId ?? ""),
		queryFn: () => fetchCollections(workspaceId ?? ""),
		enabled: workspaceId !== null,
		staleTime: STALE_MS,
	});
}

export function useCollection(collectionId: string, enabled = true) {
	return useQuery({
		queryKey: collectionKey(collectionId),
		queryFn: () => fetchCollection(collectionId),
		enabled,
		staleTime: STALE_MS,
	});
}

/** What the tree knows of one collection's items. */
export type DetailState =
	| { status: "loading" }
	| { status: "error"; retry: () => void }
	| { status: "ready"; detail: CollectionDetail };

/**
 * Details of the given collections (the expanded or searched ones), keyed
 * by id. `ids` must be memoized by the caller.
 */
export function useCollectionDetails(
	ids: readonly string[],
): ReadonlyMap<string, DetailState> {
	const combine = useCallback(
		(results: UseQueryResult<CollectionDetail>[]) => {
			const map = new Map<string, DetailState>();
			results.forEach((result, index) => {
				const id = ids[index];
				if (id === undefined) return;
				if (result.data) {
					map.set(id, { status: "ready", detail: result.data });
				} else if (result.isError) {
					map.set(id, { status: "error", retry: () => void result.refetch() });
				} else {
					map.set(id, { status: "loading" });
				}
			});
			return map;
		},
		[ids],
	);
	return useQueries({
		queries: ids.map((id) => ({
			queryKey: collectionKey(id),
			queryFn: () => fetchCollection(id),
			staleTime: STALE_MS,
		})),
		combine,
	});
}
