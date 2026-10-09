/**
 * Header lists shared by the router in the browser (a header `fetch` cannot
 * set means the request must go through the proxy) and by the proxy (which
 * strips hop-by-hop headers before forwarding).
 */
import type { HeaderEntry } from "./request-model.js";

/**
 * Forbidden request-header names of the Fetch standard, lower case, plus
 * `user-agent`: the standard allows it, but Chromium silently drops it from
 * `fetch`, so a request that sets it only keeps it through the proxy.
 */
export const FORBIDDEN_REQUEST_HEADERS: readonly string[] = Object.freeze([
	"accept-charset",
	"accept-encoding",
	"access-control-request-headers",
	"access-control-request-method",
	"access-control-request-private-network",
	"connection",
	"content-length",
	"cookie",
	"cookie2",
	"date",
	"dnt",
	"expect",
	"host",
	"keep-alive",
	"origin",
	"referer",
	"set-cookie",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"user-agent",
	"via",
]);

/** Any name starting with one of these is forbidden too. */
export const FORBIDDEN_REQUEST_HEADER_PREFIXES: readonly string[] =
	Object.freeze(["proxy-", "sec-"]);

/** Method-override headers are forbidden when they carry these methods. */
const METHOD_OVERRIDE_HEADERS = new Set([
	"x-http-method",
	"x-http-method-override",
	"x-method-override",
]);
const FORBIDDEN_METHODS = new Set(["connect", "trace", "track"]);

const FORBIDDEN_SET = new Set(FORBIDDEN_REQUEST_HEADERS);

/** True when the browser would refuse or drop this header in `fetch`. */
export function isForbiddenRequestHeader(name: string, value = ""): boolean {
	const lower = name.trim().toLowerCase();
	if (FORBIDDEN_SET.has(lower)) return true;
	if (FORBIDDEN_REQUEST_HEADER_PREFIXES.some((p) => lower.startsWith(p))) {
		return true;
	}
	if (!METHOD_OVERRIDE_HEADERS.has(lower)) return false;
	return value
		.split(",")
		.some((method) => FORBIDDEN_METHODS.has(method.trim().toLowerCase()));
}

/** Names of `headers` the browser cannot send, in order, without repeats. */
export function forbiddenHeaderNames(
	headers: readonly HeaderEntry[],
): string[] {
	const out = new Map<string, string>();
	for (const { name, value } of headers) {
		const lower = name.trim().toLowerCase();
		if (!out.has(lower) && isForbiddenRequestHeader(name, value)) {
			out.set(lower, name.trim());
		}
	}
	return [...out.values()];
}

/**
 * Hop-by-hop headers (RFC 9110 §7.6.1, plus the legacy `Keep-Alive`,
 * `Proxy-Connection` and the proxy auth pair) that a proxy must not
 * forward in either direction.
 */
export const HOP_BY_HOP_HEADERS: readonly string[] = Object.freeze([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"proxy-connection",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

const HOP_BY_HOP_SET = new Set(HOP_BY_HOP_HEADERS);

/**
 * Every name a proxy must drop from `headers`: the fixed list plus each
 * name listed in a `Connection` header, lower case.
 */
export function hopByHopNames(headers: readonly HeaderEntry[]): Set<string> {
	const names = new Set(HOP_BY_HOP_SET);
	for (const { name, value } of headers) {
		if (name.trim().toLowerCase() !== "connection") continue;
		for (const token of value.split(",")) {
			const listed = token.trim().toLowerCase();
			if (listed) names.add(listed);
		}
	}
	return names;
}

/** `headers` without hop-by-hop ones, order and repeats kept. */
export function stripHopByHop(headers: readonly HeaderEntry[]): HeaderEntry[] {
	const drop = hopByHopNames(headers);
	return headers.filter((h) => !drop.has(h.name.trim().toLowerCase()));
}

/** RFC 9110 `token`: the only characters a field name may contain. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** CR, LF and NUL would split or end the header line. */
const HEADER_VALUE_INVALID = /[\r\n\0]/;

export function isValidHeaderName(name: string): boolean {
	return HEADER_NAME_PATTERN.test(name);
}

export function isValidHeaderValue(value: string): boolean {
	return !HEADER_VALUE_INVALID.test(value);
}
