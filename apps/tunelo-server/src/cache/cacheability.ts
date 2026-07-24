// Dev-first response-cache classifier: cache static FE assets the origin marks
// cacheable; bypass everything else (API/JSON/dynamic, dev-server `no-cache`,
// streams). Never force-cache — a developer editing code must see fresh output.

export interface CacheClassifierConfig {
	readonly maxTtlSeconds: number;
}

export interface CacheDecision {
	readonly cacheable: boolean;
	readonly ttl: number;
}

/** Static FE asset extensions worth caching. */
const STATIC_EXTENSIONS = new Set([
	".js",
	".mjs",
	".cjs",
	".css",
	".map",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp",
	".avif",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".otf",
	".eot",
	".wasm",
]);

/**
 * Content-type prefixes for static FE assets. `text/html` is deliberately
 * excluded so the SPA shell always stays fresh and picks up new asset hashes.
 */
const STATIC_CONTENT_TYPES = [
	"text/css",
	"application/javascript",
	"text/javascript",
	"image/",
	"font/",
	"application/font",
	"application/wasm",
];

/** Path prefixes that are always dynamic/API → never cached. */
const API_PATH_PREFIXES = [
	"/api",
	"/graphql",
	"/trpc",
	"/rest",
	"/socket.io",
	"/_next/data",
];

function pathname(path: string): string {
	const q = path.indexOf("?");
	return (q >= 0 ? path.slice(0, q) : path).toLowerCase();
}

export function isApiPath(path: string): boolean {
	const p = pathname(path);
	return API_PATH_PREFIXES.some(
		(prefix) => p === prefix || p.startsWith(`${prefix}/`),
	);
}

function extensionOf(path: string): string {
	const p = pathname(path);
	const slash = p.lastIndexOf("/");
	const dot = p.lastIndexOf(".");
	return dot > slash ? p.slice(dot) : "";
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

function isStaticAsset(path: string, contentType: string): boolean {
	if (STATIC_EXTENSIONS.has(extensionOf(path))) return true;
	return STATIC_CONTENT_TYPES.some((prefix) => contentType.startsWith(prefix));
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
// Cost: one local Redis GET per dynamic GET.
export function isLookupEligible(
	method: string,
	path: string,
	hasAuth: boolean,
): boolean {
	return isCacheableRequest(method, hasAuth) && !isApiPath(path);
}

// Normalize Accept-Encoding to a cache-variant token: keying on it prevents
// serving a gzip/br body to a client that only accepts identity.
export function normalizeAcceptEncoding(acceptEncoding: string): string {
	const ae = acceptEncoding.toLowerCase();
	if (ae.includes("br")) return "br";
	if (ae.includes("gzip")) return "gzip";
	return "identity";
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
	if (cc.noStore || cc.noCache || cc.isPrivate || cc.maxAge === 0)
		return bypass;

	const declared =
		cc.maxAge ?? (cc.immutable ? config.maxTtlSeconds : undefined);
	if (declared === undefined || declared <= 0) return bypass;

	const ttl = Math.floor(Math.min(declared, config.maxTtlSeconds));
	return ttl > 0 ? { cacheable: true, ttl } : bypass;
}
