import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchCollections } from "./search-api";
import { COLLECTIONS_KEY } from "./use-collections";

/** Typing settles this long before the search goes out. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * Server search for the sidebar. `settled` is the search text once typing
 * paused (`SEARCH_DEBOUNCE_MS`, debounced by the sidebar, which outlives
 * the results); a newer query cancels the request of the one it replaces
 * (react-query aborts its signal).
 */
export function useCollectionSearch(
	workspaceId: string | null,
	settled: string,
) {
	return useQuery({
		queryKey: [...COLLECTIONS_KEY, "search", workspaceId ?? "", settled],
		queryFn: ({ signal }) =>
			searchCollections(workspaceId ?? "", settled, signal),
		enabled: workspaceId !== null && settled !== "",
		placeholderData: keepPreviousData,
		staleTime: 10_000,
	});
}
