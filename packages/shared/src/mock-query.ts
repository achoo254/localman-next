/**
 * Query parameters the public mock runtime reads on list routes, and the
 * caps it applies. The runtime parses requests with these lists and the
 * web docs print them, so both always name the same parameters.
 */
export const MOCK_QUERY_PARAMS = {
	search: ["search", "filter"],
	page: ["page", "p"],
	limit: ["limit", "l"],
	sort: ["sortBy", "sortby", "orderBy", "orderby"],
	order: ["order"],
} as const satisfies Record<string, readonly string[]>;

/** Most records one page returns; a larger `limit` is lowered to it. */
export const MAX_PAGE_LIMIT = 100;

/** Largest JSON body the API and the mock runtime accept, in KB. */
export const MAX_JSON_BODY_KB = 100;
