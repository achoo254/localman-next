import type { OperationContext } from "@localman/operations";
import type { HeaderEntry } from "@localman/shared/api-client";
import { z } from "zod";

/**
 * Header values of a callback may be secrets (a webhook signing key…).
 * Only the owner in the dashboard (a browser session) reads them; members
 * and every MCP call, the owner's included, get this in their place.
 */
export const HIDDEN_HEADER_VALUE = "[hidden]";

/** A callback header as shown; `hidden` when `value` is the placeholder. */
export const callbackHeaderView = z.object({
	name: z.string(),
	value: z.string(),
	hidden: z.boolean(),
});
export type CallbackHeaderView = z.infer<typeof callbackHeaderView>;

/**
 * Whether the caller may read header values: the project owner through a
 * browser session. MCP calls carry no session (see `requireSession`), so
 * an agent never reads them, even with the owner's token.
 */
export function revealsHeaderValues(
	ctx: OperationContext,
	isOwner: boolean,
): boolean {
	const auth = ctx.auth;
	return (
		isOwner &&
		auth !== null &&
		"sessionId" in auth &&
		typeof auth.sessionId === "string"
	);
}

export function toHeaderViews(
	headers: readonly HeaderEntry[],
	reveal: boolean,
): CallbackHeaderView[] {
	return headers.map(({ name, value }) =>
		reveal
			? { name, value, hidden: false }
			: { name, value: HIDDEN_HEADER_VALUE, hidden: true },
	);
}

/**
 * The headers to store: a value equal to `HIDDEN_HEADER_VALUE` takes the
 * stored value of the same-named header of the same callback (the n-th
 * header of a name matches the n-th stored one, names compared without
 * case), so a form sent back as shown keeps its secrets. Without a
 * stored counterpart the value is kept as typed.
 */
export function keepHiddenValues(
	headers: readonly HeaderEntry[],
	stored: readonly HeaderEntry[],
): HeaderEntry[] {
	const seen = new Map<string, number>();
	return headers.map(({ name, value }) => {
		const key = name.toLowerCase();
		const nth = seen.get(key) ?? 0;
		seen.set(key, nth + 1);
		if (value !== HIDDEN_HEADER_VALUE) return { name, value };
		const same = stored.filter((header) => header.name.toLowerCase() === key);
		return { name, value: same[nth]?.value ?? value };
	});
}

/**
 * Names of a callback request's headers a log line masks: all but
 * `Content-Type` and Localman's own `X-Localman-*` markers. A log line is
 * read by every member and over MCP, so custom header values never reach
 * it, whatever the project's masked names are.
 */
export function maskedCallbackHeaders(
	headers: readonly HeaderEntry[],
): string[] {
	return headers
		.map(({ name }) => name.toLowerCase())
		.filter(
			(name) => name !== "content-type" && !name.startsWith("x-localman-"),
		);
}

/** A callback URL's query as shown to who may not read header values. */
export const HIDDEN_QUERY = `?${HIDDEN_HEADER_VALUE}`;

function parsedUrl(url: string): URL | null {
	return URL.canParse(url) ? new URL(url) : null;
}

/** `origin` + path of a URL, no query or fragment (log lines). */
export function urlWithoutQuery(url: string): string {
	const parsed = parsedUrl(url);
	return parsed
		? `${parsed.origin}${parsed.pathname}`
		: (url.split(/[?#]/)[0] ?? "");
}

/**
 * A URL as shown without header values: webhook URLs often carry their
 * token in the query, so it reads `?[hidden]`; origin and path stay.
 */
export function hideUrlQuery(url: string): string {
	const query = parsedUrl(url)?.search ?? "";
	return `${urlWithoutQuery(url)}${query === "" ? "" : HIDDEN_QUERY}`;
}

/**
 * The URL to store: one sent back as shown (`…?[hidden]`) takes the
 * stored URL's query when origin and path are unchanged, so the token is
 * kept, as `keepHiddenValues` does for headers. A query is never carried
 * to another origin or path; otherwise the URL is kept as typed.
 */
export function keepHiddenQuery(url: string, stored: string | null): string {
	const typed = parsedUrl(url.trim());
	const before = stored === null ? null : parsedUrl(stored);
	if (!typed || !before || typed.search !== HIDDEN_QUERY) return url;
	const same =
		typed.origin === before.origin && typed.pathname === before.pathname;
	return same ? `${before.origin}${before.pathname}${before.search}` : url;
}
