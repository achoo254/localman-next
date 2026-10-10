import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { ENDPOINT_TAB_PARAM } from "../../pages/project-detail/endpoint-tabs";
import { LOG_FILTER_PARAMS, type LogFilters } from "./log-filters";

/** Value of `?endpoint=` for the request log tab. */
export const REQUEST_LOG_TAB = "log";

/**
 * Switches the endpoint card to the request log, filtered: for links such
 * as "the requests of this inbox" (`{ source: "inbox", path: "/_inbox/x" }`).
 * The log tab reads the filters when it mounts, then drops them from the
 * address.
 */
export function useShowRequestLog(): (filters: Partial<LogFilters>) => void {
	const [, setParams] = useSearchParams();
	return useCallback(
		(filters: Partial<LogFilters>) => {
			setParams(
				(previous) => {
					const next = new URLSearchParams(previous);
					next.set(ENDPOINT_TAB_PARAM, REQUEST_LOG_TAB);
					const put = (name: string, value: string | undefined) => {
						if (value) next.set(name, value);
						else next.delete(name);
					};
					put(LOG_FILTER_PARAMS.method, filters.method);
					put(LOG_FILTER_PARAMS.status, filters.status);
					put(LOG_FILTER_PARAMS.source, filters.source);
					put(LOG_FILTER_PARAMS.path, filters.path);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);
}
