/**
 * Query string <-> params table, and URL normalisation before sending.
 * Works on the raw text, so a URL still holding `{{baseUrl}}` is fine.
 */
import type { KeyValueRow } from "./request-model.js";

interface UrlParts {
	base: string;
	query: string | null;
	fragment: string | null;
}

/** `base?query#fragment`; the fragment is split first, as a `?` in it is not a query. */
function splitUrl(url: string): UrlParts {
	const hashAt = url.indexOf("#");
	const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
	const fragment = hashAt === -1 ? null : url.slice(hashAt + 1);
	const queryAt = beforeHash.indexOf("?");
	return queryAt === -1
		? { base: beforeHash, query: null, fragment }
		: {
				base: beforeHash.slice(0, queryAt),
				query: beforeHash.slice(queryAt + 1),
				fragment,
			};
}

/** Params of the URL's query, in order, repeats kept, all enabled. */
export function parseQueryFromUrl(
	url: string,
	newId: () => string,
): KeyValueRow[] {
	const { query } = splitUrl(url);
	if (!query) return [];
	const rows: KeyValueRow[] = [];
	new URLSearchParams(query).forEach((value, key) => {
		rows.push({ id: newId(), key, value, enabled: true });
	});
	return rows;
}

/**
 * The URL with its query rebuilt from the enabled params (key trimmed,
 * key and value percent-encoded), fragment kept. With no params at all the
 * URL is returned untouched: callers that only set a URL (an agent, an
 * import) keep their query.
 */
export function buildUrlWithParams(
	url: string,
	params: readonly KeyValueRow[],
): string {
	if (params.length === 0) return url;
	const { base, fragment } = splitUrl(url);
	const search = new URLSearchParams();
	for (const param of params) {
		const key = param.key.trim();
		if (param.enabled && key) search.append(key, param.value);
	}
	const query = search.toString();
	const withQuery = query ? `${base}?${query}` : base;
	return fragment === null ? withQuery : `${withQuery}#${fragment}`;
}

/** Appends percent-encoded pairs to the URL's query (API key in query). */
export function appendQueryParams(
	url: string,
	pairs: readonly { key: string; value: string }[],
): string {
	if (pairs.length === 0) return url;
	const { base, query, fragment } = splitUrl(url);
	const added = new URLSearchParams();
	for (const { key, value } of pairs) added.append(key, value);
	const joined = query ? `${query}&${added}` : added.toString();
	const withQuery = `${base}?${joined}`;
	return fragment === null ? withQuery : `${withQuery}#${fragment}`;
}

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Adds `http://` when no scheme was typed (`localhost:3000/users`). */
export function normalizeRequestUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return trimmed;
	return SCHEME_PATTERN.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/** Parsed http(s) URL, or `null` for anything else. */
export function parseHttpUrl(url: string): URL | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	return parsed.protocol === "http:" || parsed.protocol === "https:"
		? parsed
		: null;
}
