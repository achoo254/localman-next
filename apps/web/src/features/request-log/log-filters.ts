/**
 * Filters of the request log. The list and the live stream take the same
 * query (`method`, `status`, `source`, `path`), so one string keys both.
 */
import { type LogSource, isLogSource } from "./request-log-parse";

export interface LogFilters {
	/** `""` for every method. */
	method: string;
	/** Status class (`2xx`…) or `""`. */
	status: string;
	source: LogSource | "";
	/** Case-insensitive substring of the path. */
	path: string;
}

export const NO_FILTERS: LogFilters = Object.freeze({
	method: "",
	status: "",
	source: "",
	path: "",
});

export const FILTER_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
] as const;
export const FILTER_STATUSES = ["2xx", "3xx", "4xx", "5xx"] as const;
/** Longest path filter the API accepts. */
export const MAX_PATH_FILTER = 200;

export function filtersActive(filters: LogFilters): boolean {
	return (
		filters.method !== "" ||
		filters.status !== "" ||
		filters.source !== "" ||
		filters.path.trim() !== ""
	);
}

/** Query string of the list and the stream, without `?` ("" when none). */
export function filterQuery(filters: LogFilters): string {
	const params = new URLSearchParams();
	if (filters.method) params.set("method", filters.method);
	if (filters.status) params.set("status", filters.status);
	if (filters.source) params.set("source", filters.source);
	const path = filters.path.trim();
	if (path) params.set("path", path);
	return params.toString();
}

/**
 * Search parameters of the project page that open the log already
 * filtered (another tab links to "requests of this inbox").
 */
export const LOG_FILTER_PARAMS = {
	method: "logMethod",
	status: "logStatus",
	source: "logSource",
	path: "logPath",
} as const;

const oneOf = (value: string | null, allowed: readonly string[]): string =>
	value !== null && allowed.includes(value) ? value : "";

/** Filters in the page's search parameters; anything unknown is dropped. */
export function filtersFromSearch(params: URLSearchParams): LogFilters {
	const source = params.get(LOG_FILTER_PARAMS.source) ?? "";
	return {
		method: oneOf(params.get(LOG_FILTER_PARAMS.method), FILTER_METHODS),
		status: oneOf(params.get(LOG_FILTER_PARAMS.status), FILTER_STATUSES),
		source: isLogSource(source) ? source : "",
		path: (params.get(LOG_FILTER_PARAMS.path) ?? "").slice(0, MAX_PATH_FILTER),
	};
}
