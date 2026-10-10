import {
	type InfiniteData,
	type UseInfiniteQueryResult,
	useInfiniteQuery,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { type LogFilters, filterQuery } from "./log-filters";
import { fetchLogPage, requestLogKey } from "./request-log-api";
import type { LogPage, LogSummary } from "./request-log-parse";
import { type LiveRows, mergeRows, useLiveRows } from "./use-live-rows";
import { type LiveState, useLogStream, usePageVisible } from "./use-log-stream";

const FIRST_PAGE: string | null = null;

export interface RequestLog {
	/** Live and listed rows, newest first. */
	rows: LogSummary[];
	history: UseInfiniteQueryResult<InfiniteData<LogPage>>;
	liveState: LiveState;
	live: LiveRows;
}

/**
 * The project's log under `filters`: pages of history (cursor) plus rows
 * arriving over the live stream while `live` is on and the page visible.
 * A stream that opens again after a gap reloads the history it missed.
 */
export function useRequestLog(
	projectId: string,
	filters: LogFilters,
	live: boolean,
): RequestLog {
	const query = filterQuery(filters);
	const visible = usePageVisible();
	const history = useInfiniteQuery({
		queryKey: [...requestLogKey(projectId), query],
		queryFn: ({ pageParam }) => fetchLogPage(projectId, query, pageParam),
		initialPageParam: FIRST_PAGE,
		getNextPageParam: (last: LogPage) => last.nextCursor,
	});
	const liveRows = useLiveRows(`${projectId}?${query}`);
	const pages = history.data?.pages;
	const listed = useMemo(
		() => pages?.flatMap((page) => page.items) ?? [],
		[pages],
	);
	// A streamed line already listed (an inbox forward's attempts arriving
	// later) updates its row rather than coming in as a new request.
	const listedIds = useMemo(
		() => new Set(listed.map((row) => row.id)),
		[listed],
	);
	const { push } = liveRows;
	const onLine = useCallback(
		(line: LogSummary) => push(line, listedIds.has(line.id)),
		[push, listedIds],
	);
	const liveState = useLogStream({
		projectId,
		query,
		enabled: live && visible,
		onLine,
		onResume: () => void history.refetch(),
	});
	const rows = useMemo(
		() => mergeRows(liveRows.rows, listed),
		[liveRows.rows, listed],
	);
	return { rows, history, liveState, live: liveRows };
}
