import {
	type QueryClient,
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	clearHistory,
	deleteHistoryEntry,
	fetchHistoryPage,
} from "./history-api";

/** Cache key of the history list; invalidate it after recording a send. */
export const HISTORY_QUERY_KEY = ["api-client", "history"] as const;

/** Refreshes the history list (after a send was recorded, for instance). */
export function invalidateHistory(queryClient: QueryClient): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
}

/** History pages, newest first, loaded one cursor at a time. */
export function useHistoryList() {
	const query = useInfiniteQuery({
		queryKey: HISTORY_QUERY_KEY,
		queryFn: ({ pageParam }) => fetchHistoryPage(pageParam),
		initialPageParam: null as string | null,
		getNextPageParam: (last) => last.nextCursor,
	});
	const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
	return { ...query, entries };
}

export function useDeleteHistoryEntry() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteHistoryEntry,
		onSuccess: () => invalidateHistory(queryClient),
	});
}

export function useClearHistory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => clearHistory(false),
		onSuccess: () => invalidateHistory(queryClient),
	});
}
