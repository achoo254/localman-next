import type { HeaderEntry } from "@localman/shared/api-client";
import type { Response } from "express";

/**
 * Upstream response headers the runtime relays besides `x-*`: the body's
 * type, caching, language, retry hints and redirects. An allowlist, so
 * cookies, security policies (CSP, HSTS), CORS (the runtime's open CORS
 * stays authoritative), `Content-Disposition`, `Refresh`, `Link`, framing
 * and anything browsers learn later stay with the platform.
 */
const RELAYED = new Set([
	"content-type",
	"cache-control",
	"etag",
	"last-modified",
	"expires",
	"vary",
	"content-language",
	"location",
	"retry-after",
]);

/** `x-*` headers that are security or platform controls, not data. */
const RESERVED_X = new Set([
	"x-frame-options",
	"x-xss-protection",
	"x-content-type-options",
]);
/** `X-Accel-*` would steer nginx (internal redirects, buffering). */
const RESERVED_X_PREFIXES = ["x-localman-", "x-accel-", "x-forwarded-"];

/** Whether the runtime passes the upstream's header `lower` on. */
export function isRelayedResponseHeader(lower: string): boolean {
	if (RELAYED.has(lower)) return true;
	return (
		lower.startsWith("x-") &&
		!RESERVED_X.has(lower) &&
		!RESERVED_X_PREFIXES.some((prefix) => lower.startsWith(prefix))
	);
}

/** `Vary` without `Cookie` (no cookie reaches or leaves the upstream). */
function varyOf(value: string): string | null {
	const kept = value
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name !== "" && name.toLowerCase() !== "cookie");
	return kept.length > 0 ? kept.join(", ") : null;
}

/** A scheme (`https:`, `javascript:`) or `//host`, with `\` read as `/`. */
const ABSOLUTE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * `Location` as the client may see it: a relative reference as sent; an
 * absolute one only on the upstream's own origin, rewritten to its path
 * (the client stays on the mock); anything else dropped (`null`).
 */
export function relayedLocation(
	value: string,
	upstreamUrl: string,
): string | null {
	// Browsers drop tabs and newlines anywhere in a URL: `/\t/evil` is `//evil`.
	const trimmed = value.replace(/[\t\n\r]/g, "").trim();
	if (trimmed === "") return null;
	if (!ABSOLUTE.test(trimmed.replaceAll("\\", "/"))) return trimmed;
	let target: URL;
	try {
		target = new URL(trimmed, upstreamUrl);
	} catch {
		return null;
	}
	if (target.origin !== new URL(upstreamUrl).origin) return null;
	// `//evil.example/x` as a path would leave the mock again.
	const path = target.pathname.replace(/^\/+/, "/");
	return `${path}${target.search}${target.hash}`;
}

function relayedValue(
	lower: string,
	value: string,
	upstreamUrl: string,
): string | null {
	if (lower === "vary") return varyOf(value);
	if (lower === "location") return relayedLocation(value, upstreamUrl);
	return value;
}

/**
 * Copies the upstream's allowed headers (`isRelayedResponseHeader`) onto
 * `res`, repeats kept as lists; `upstreamUrl` is where the request went
 * (the origin a `Location` may point at).
 */
export function relayResponseHeaders(
	res: Response,
	headers: readonly HeaderEntry[],
	upstreamUrl: string,
): void {
	const grouped = new Map<string, { name: string; values: string[] }>();
	for (const { name, value } of headers) {
		const lower = name.trim().toLowerCase();
		if (!isRelayedResponseHeader(lower)) continue;
		const relayed = relayedValue(lower, value, upstreamUrl);
		if (relayed === null) continue;
		const entry = grouped.get(lower) ?? { name, values: [] };
		entry.values.push(relayed);
		grouped.set(lower, entry);
	}
	for (const { name, values } of grouped.values()) {
		res.setHeader(name, values.length === 1 ? (values[0] ?? "") : values);
	}
}
