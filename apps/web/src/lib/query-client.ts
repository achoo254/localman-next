import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

/** A 4xx answer will not change on retry; network and 5xx errors may. */
function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
		return false;
	}
	return failureCount < 2;
}

/**
 * TanStack Query client of the app. Window-focus refetches are off: the
 * project detail page edits cached lists optimistically and a background
 * refetch in the middle of that would only add flicker.
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: shouldRetry, refetchOnWindowFocus: false },
			mutations: { retry: false },
		},
	});
}
