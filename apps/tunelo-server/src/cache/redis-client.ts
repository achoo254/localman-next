import { Redis } from "ioredis";
import { createLogger } from "../logger.js";
import { CACHE_CONFIG, isCacheEnabled } from "./cache-config.js";

const logger = createLogger("tunelo-cache-redis");

let client: Redis | null = null;
let attempted = false;

/**
 * Shared cache client, created on first use. Returns null when caching is
 * disabled or no REDIS_URL is set — callers then behave as a pure passthrough
 * relay. Offline queue is off so a down Redis fails fast (treated as a miss)
 * instead of blocking the relay hot path.
 */
export function getRedis(): Redis | null {
	if (!isCacheEnabled() || !CACHE_CONFIG.redisUrl) return null;
	if (attempted) return client;
	attempted = true;
	client = new Redis(CACHE_CONFIG.redisUrl, {
		enableOfflineQueue: false,
		maxRetriesPerRequest: 1,
		connectTimeout: 1000,
		retryStrategy: (times) => Math.min(times * 200, 2000),
	});
	client.on("error", (err) =>
		logger.warn({ err: err.message }, "Redis cache connection error"),
	);
	client.on("connect", () => logger.info("Redis cache connected"));
	return client;
}
