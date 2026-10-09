/**
 * Two-way link between the URL's query and the Params table. Each side
 * only rewrites the other when it is the one being edited, and a pair the
 * edit did not touch keeps its text as typed (`?flag` stays `?flag`, `~`
 * and `,` stay unescaped), so what the user sees is what goes out.
 */
import {
	type ApiRequestDraft,
	type KeyValueRow,
	VARIABLE_PATTERN,
	parseQueryFromUrl,
} from "@localman/shared/api-client";

/** Percent-encodes `text` but leaves `{{var}}` readable and fillable. */
function encodePart(text: string): string {
	let out = "";
	let last = 0;
	for (const match of text.matchAll(VARIABLE_PATTERN)) {
		const at = match.index ?? 0;
		out += encodeURIComponent(text.slice(last, at)) + match[0];
		last = at + match[0].length;
	}
	return out + encodeURIComponent(text.slice(last));
}

interface UrlParts {
	base: string;
	/** Text after `?`, without it; empty when there is none. */
	query: string;
	/** `#…` included, or empty. */
	hash: string;
}

function splitUrl(url: string): UrlParts {
	const hashAt = url.indexOf("#");
	const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
	const hash = hashAt === -1 ? "" : url.slice(hashAt);
	const queryAt = beforeHash.indexOf("?");
	return queryAt === -1
		? { base: beforeHash, query: "", hash }
		: {
				base: beforeHash.slice(0, queryAt),
				query: beforeHash.slice(queryAt + 1),
				hash,
			};
}

/** One pair of a query: its text as typed and what it decodes to. */
interface QueryPair {
	raw: string;
	key: string;
	value: string;
}

/** Pairs in order, as `parseQueryFromUrl` reads them (empty ones skipped). */
function queryPairs(query: string): QueryPair[] {
	const pairs: QueryPair[] = [];
	for (const raw of query.split("&")) {
		if (raw === "") continue;
		const decoded = new URLSearchParams(raw).entries().next();
		if (decoded.done) continue;
		const [key, value] = decoded.value;
		pairs.push({ raw, key, value });
	}
	return pairs;
}

const sendable = (params: readonly KeyValueRow[]) =>
	params.filter((param) => param.enabled && param.key.trim());

/** The query already says exactly what the enabled params say. */
export function queryMatchesParams(
	url: string,
	params: readonly KeyValueRow[],
): boolean {
	const pairs = queryPairs(splitUrl(url).query);
	const rows = sendable(params);
	return (
		pairs.length === rows.length &&
		pairs.every(
			(pair, index) =>
				pair.key.trim() === rows[index]?.key.trim() &&
				pair.value === rows[index]?.value,
		)
	);
}

/**
 * The URL with its query rebuilt from the enabled params, fragment kept.
 * A param equal to a pair already in the query reuses that pair's text;
 * only new or edited ones are encoded.
 */
export function urlWithParams(
	url: string,
	params: readonly KeyValueRow[],
): string {
	if (queryMatchesParams(url, params)) return url;
	const { base, query, hash } = splitUrl(url);
	const unused = queryPairs(query);
	const parts = sendable(params).map((param) => {
		const key = param.key.trim();
		const at = unused.findIndex(
			(pair) => pair.key.trim() === key && pair.value === param.value,
		);
		const kept = unused[at];
		if (kept) {
			// Each typed pair is reused once: a repeated param keeps its order.
			unused.splice(at, 1);
			return kept.raw;
		}
		return param.value === ""
			? encodePart(key)
			: `${encodePart(key)}=${encodePart(param.value)}`;
	});
	return `${base}${parts.length > 0 ? `?${parts.join("&")}` : ""}${hash}`;
}

/**
 * Params after the URL was edited: one enabled row per query pair, reusing
 * the id and description of the row at the same place, then the disabled
 * rows (they are not in the URL, so they stay as they were).
 */
export function paramsFromUrl(
	url: string,
	previous: readonly KeyValueRow[],
	newId: () => string,
): KeyValueRow[] {
	const enabled = previous.filter((param) => param.enabled);
	const parsed = parseQueryFromUrl(url, newId).map((row, index) => {
		const before = enabled[index];
		return before
			? { ...row, id: before.id, description: before.description }
			: row;
	});
	return [...parsed, ...previous.filter((param) => !param.enabled)];
}

/**
 * The draft to prepare for the wire. When the URL's query already holds
 * every enabled param it goes out as typed: the preparer would otherwise
 * re-encode it from the params (`?flag` → `?flag=`, `~` → `%7E`). A query
 * with `{{var}}` still goes through the params, which encode filled values.
 */
export function withVerbatimQuery(draft: ApiRequestDraft): ApiRequestDraft {
	if (draft.params.length === 0) return draft;
	if (splitUrl(draft.url).query.includes("{{")) return draft;
	if (!queryMatchesParams(draft.url, draft.params)) return draft;
	return { ...draft, params: [] };
}
