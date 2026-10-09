import { OperationError } from "@localman/operations";
import {
	FORBIDDEN_KEYS,
	type JsonObject,
	type JsonValue,
	MAX_PAGE_LIMIT,
	MOCK_QUERY_PARAMS,
} from "@localman/shared";
import { compareValues, matchesFilter, matchesSearch } from "./query-match.js";

export { MAX_PAGE_LIMIT };

const {
	search: SEARCH_KEYS,
	page: PAGE_KEYS,
	limit: LIMIT_KEYS,
	sort: SORT_KEYS,
	order: ORDER_KEYS,
} = MOCK_QUERY_PARAMS;
const RESERVED: ReadonlySet<string> = new Set(
	Object.values(MOCK_QUERY_PARAMS).flat(),
);
const FORBIDDEN: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);

/** Fields a list may be filtered and sorted by. */
export interface QueryFields {
	/** Schema (or object template) fields, relation fields excluded. */
	readonly fields: ReadonlySet<string>;
	/** `id` and `{parent}Id`: matched exactly, not as substrings. */
	readonly exact: ReadonlySet<string>;
}

export interface ListQuery {
	readonly search: readonly string[];
	readonly filters: readonly { field: string; value: string; exact: boolean }[];
	readonly sort: { readonly field: string; readonly desc: boolean } | null;
	readonly page: { readonly page: number; readonly limit: number } | null;
}

function invalidQuery(message: string): OperationError {
	return new OperationError(400, "INVALID_QUERY", message);
}

/**
 * Names that could address operators or prototype machinery: `$where`,
 * `a.b`, `title[$ne]` (Express's simple parser keeps brackets in the key)
 * and `__proto__`/`constructor`/`prototype`. Refused outright, as keys and
 * as `sortBy` values, so no user text ever reaches a query or a property
 * lookup outside the known field list.
 */
function isUnsafeName(name: string): boolean {
	return name.startsWith("$") || /[.[\]]/.test(name) || FORBIDDEN.has(name);
}

/** A positive integer, or `null` (ignored like an absent parameter). */
function positiveInt(text: string | undefined): number | null {
	if (text === undefined || !/^\d{1,9}$/.test(text)) return null;
	const value = Number(text);
	return value > 0 ? value : null;
}

function firstOf(
	params: ReadonlyMap<string, string>,
	keys: readonly string[],
): string | undefined {
	for (const key of keys) {
		const value = params.get(key);
		if (value !== undefined) return value;
	}
	return undefined;
}

/**
 * Validates `req.query` (Express "simple" parser: strings or arrays) and
 * reads the list options of the source. Unsafe keys and repeated or
 * structured values answer 400 `INVALID_QUERY`; keys that are not a
 * known field are ignored, as are unknown `sortBy` fields and malformed
 * `page`/`limit`.
 */
export function parseListQuery(
	query: Readonly<Record<string, unknown>>,
	known: QueryFields,
): ListQuery {
	const params = new Map<string, string>();
	for (const [key, value] of Object.entries(query)) {
		if (isUnsafeName(key)) {
			throw invalidQuery(
				'Query parameter names cannot start with "$", contain ".", "[" or "]", or be __proto__, constructor or prototype',
			);
		}
		if (typeof value !== "string") {
			throw invalidQuery("Each query parameter may appear only once");
		}
		params.set(key, value);
	}
	const sortField = firstOf(params, SORT_KEYS);
	if (sortField !== undefined && isUnsafeName(sortField)) {
		throw invalidQuery("sortBy must name a field of the resource");
	}
	const sortable =
		sortField !== undefined &&
		(known.fields.has(sortField) || known.exact.has(sortField));
	const limit = positiveInt(firstOf(params, LIMIT_KEYS));
	return {
		search: SEARCH_KEYS.flatMap((key) => {
			const value = params.get(key);
			return value ? [value.toLowerCase()] : [];
		}),
		filters: [...params]
			.filter(([key]) => !RESERVED.has(key))
			.filter(([key]) => known.fields.has(key) || known.exact.has(key))
			.map(([field, value]) => ({
				field,
				value,
				exact: known.exact.has(field),
			})),
		sort: sortable
			? {
					field: sortField,
					desc: firstOf(params, ORDER_KEYS)?.toLowerCase() === "desc",
				}
			: null,
		page:
			limit === null
				? null
				: {
						page: positiveInt(firstOf(params, PAGE_KEYS)) ?? 1,
						limit: Math.min(limit, MAX_PAGE_LIMIT),
					},
	};
}

/** The record's own value of `field`; never an inherited property. */
export function fieldOf(
	record: JsonObject,
	field: string,
): JsonValue | undefined {
	return Object.hasOwn(record, field) ? record[field] : undefined;
}

export interface ListResult {
	readonly items: JsonObject[];
	/** Records left after filtering, before pagination (`$count`). */
	readonly total: number;
}

/** Filters (AND), sorts (stable) and pages records in memory. */
export function applyListQuery(
	records: readonly JsonObject[],
	query: ListQuery,
): ListResult {
	const matching = records.filter(
		(record) =>
			query.search.every((text) => matchesSearch(record, text)) &&
			query.filters.every(({ field, value, exact }) =>
				matchesFilter(fieldOf(record, field), value, exact),
			),
	);
	const { sort, page } = query;
	if (sort) {
		const direction = sort.desc ? -1 : 1;
		matching.sort(
			(a, b) =>
				direction *
				compareValues(fieldOf(a, sort.field), fieldOf(b, sort.field)),
		);
	}
	const items = page
		? matching.slice((page.page - 1) * page.limit, page.page * page.limit)
		: matching;
	return { items, total: matching.length };
}
