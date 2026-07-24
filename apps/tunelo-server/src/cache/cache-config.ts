/** Response-cache configuration, resolved once from the environment. */

function positiveInt(name: string, fallback: number): number {
	const raw = process.env[name];
	const value = raw ? Number(raw) : Number.NaN;
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const CACHE_CONFIG = {
	redisUrl: process.env.REDIS_URL,
	/** Max response body (bytes) worth caching — larger responses stream uncached. */
	maxObjectBytes: positiveInt("CACHE_MAX_OBJECT_BYTES", 5 * 1024 * 1024),
	/** Upper bound on TTL; the effective TTL is the origin's max-age, capped here. */
	maxTtlSeconds: positiveInt("CACHE_MAX_TTL_SECONDS", 86_400),
} as const;

/** Caching is on only when a REDIS_URL is set and not explicitly disabled. */
export function isCacheEnabled(): boolean {
	if (process.env.CACHE_ENABLED === "false") return false;
	return Boolean(CACHE_CONFIG.redisUrl);
}
