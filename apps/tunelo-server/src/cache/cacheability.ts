// Dev-first response-cache decision. Two safe ways an asset becomes cacheable:
//   1. the origin marks it cacheable (Cache-Control max-age/immutable), or
//   2. its filename is content-hashed (e.g. index-DqxaS-SZ.js) — content-
//      addressed, so a change produces a new name and can never serve stale.
// Everything else bypasses (API/JSON/dynamic, dev-server no-cache, streams).
// Explicit opt-outs (no-store/private/max-age=0) are always honored.
import { isApiPath, isStaticAsset, looksContentHashed } from "./asset-rules.js";

export interface CacheClassifierConfig {
	readonly maxTtlSeconds: number;
}

export interface CacheDecision {
	readonly cacheable: boolean;
	readonly ttl: number;
}

function headerValue(
	headers: Record<string, string | string[]>,
	name: string,
): string {
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== name) continue;
		return Array.isArray(value) ? value.join(", ") : value;
	}
	return "";
}

function hasHeader(
	headers: Record<string, string | string[]>,
	name: string,
): boolean {
	return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

interface CacheControl {
	readonly noStore: boolean;
	readonly noCache: boolean;
	readonly isPrivate: boolean;
	readonly immutable: boolean;
	readonly maxAge: number | undefined;
}

function parseCacheControl(raw: string): CacheControl {
	const parts = raw
		.toLowerCase()
		.split(",")
		.map((s) => s.trim());
	const maxAgePart = parts.find((p) => p.startsWith("max-age="));
	const maxAge = maxAgePart
		? Number(maxAgePart.slice("max-age=".length))
		: undefined;
	return {
		noStore: parts.includes("no-store"),
		noCache: parts.includes("no-cache"),
		isPrivate: parts.includes("private"),
		immutable: parts.includes("immutable"),
		maxAge:
			maxAge !== undefined && Number.isFinite(maxAge) ? maxAge : undefined,
	};
}

/**
 * A GET without Authorization is the only kind of request the cache touches.
 * Auth'd requests are never cached — a cached hit would skip the relay's Basic
 * Auth check (auth bypass).
 */
export function isCacheableRequest(method: string, hasAuth: boolean): boolean {
	return method === "GET" && !hasAuth;
}

// Skip the Redis lookup for API paths (never stored). Every other non-auth GET
// is eligible — including HTML/SPA routes — because assets are classified by
// content-type, so one with a generic/absent extension must still be looked up.
export function isLookupEligible(
	method: string,
	path: string,
	hasAuth: boolean,
): boolean {
	return isCacheableRequest(method, hasAuth) && !isApiPath(path);
}

/** True unless Vary demands a dimension we do not key on (anything but
 *  Accept-Encoding, or `*`). */
function varyIsCacheable(vary: string): boolean {
	if (!vary) return true;
	const tokens = vary.split(",").map((t) => t.trim());
	return tokens.every((t) => t === "" || t === "accept-encoding");
}

/** Decide whether a relayed response may be cached and for how long. */
export function classifyResponse(
	path: string,
	status: number,
	headers: Record<string, string | string[]>,
	config: CacheClassifierConfig,
): CacheDecision {
	const bypass: CacheDecision = { cacheable: false, ttl: 0 };
	if (status !== 200) return bypass;
	if (hasHeader(headers, "set-cookie")) return bypass;
	if (!hasHeader(headers, "content-length")) return bypass;
	if (!varyIsCacheable(headerValue(headers, "vary").toLowerCase())) {
		return bypass;
	}

	const contentType = headerValue(headers, "content-type").toLowerCase();
	if (contentType.includes("text/event-stream")) return bypass;
	if (contentType.includes("application/json")) return bypass;
	if (isApiPath(path)) return bypass;
	if (!isStaticAsset(path, contentType)) return bypass;

	const cc = parseCacheControl(headerValue(headers, "cache-control"));
	// Hard opt-outs always win, for hashed and non-hashed alike.
	if (cc.noStore || cc.isPrivate || cc.maxAge === 0) return bypass;

	// A content-hashed asset is safe to cache even without origin cache headers
	// (the name changes when the bytes change). Otherwise fall back to strict
	// respect-origin: the origin must positively declare it cacheable.
	let declared: number | undefined;
	if (looksContentHashed(path)) {
		declared = cc.maxAge ?? config.maxTtlSeconds;
	} else {
		if (cc.noCache) return bypass;
		declared = cc.maxAge ?? (cc.immutable ? config.maxTtlSeconds : undefined);
	}
	if (declared === undefined || declared <= 0) return bypass;

	const ttl = Math.floor(Math.min(declared, config.maxTtlSeconds));
	return ttl > 0 ? { cacheable: true, ttl } : bypass;
}
