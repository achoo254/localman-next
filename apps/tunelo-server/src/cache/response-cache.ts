import { createHash } from "node:crypto";
import { createLogger } from "../logger.js";
import { getRedis } from "./redis-client.js";

const logger = createLogger("tunelo-cache");

export interface CachedResponse {
	readonly status: number;
	readonly headers: Record<string, string | string[]>;
	/** Response body, base64-encoded. */
	readonly body: string;
}

const KEY_PREFIX = "tunelo:cache";

/** Key isolates by subdomain (tenant) and hashes the path (bounds length, keeps
 *  query strings out of logs). */
/** Key isolates by subdomain (tenant) and content-encoding variant, then hashes
 *  the path (bounds length, keeps query strings out of logs). Variant sits
 *  before the hash so per-subdomain purge (`:{subdomain}:*`) still matches. */
function keyFor(subdomain: string, variant: string, path: string): string {
	const hash = createHash("sha1").update(path).digest("hex");
	return `${KEY_PREFIX}:${subdomain}:${variant}:${hash}`;
}

export async function getCached(
	subdomain: string,
	path: string,
	variant: string,
): Promise<CachedResponse | null> {
	const redis = getRedis();
	if (!redis) return null;
	try {
		const raw = await redis.get(keyFor(subdomain, variant, path));
		return raw ? (JSON.parse(raw) as CachedResponse) : null;
	} catch (err) {
		logger.warn(
			{ err: (err as Error).message, subdomain },
			"Cache read failed",
		);
		return null;
	}
}

export async function setCached(
	subdomain: string,
	path: string,
	variant: string,
	entry: CachedResponse,
	ttlSeconds: number,
): Promise<void> {
	const redis = getRedis();
	if (!redis || ttlSeconds <= 0) return;
	try {
		await redis.set(
			keyFor(subdomain, variant, path),
			JSON.stringify(entry),
			"EX",
			ttlSeconds,
		);
	} catch (err) {
		logger.warn(
			{ err: (err as Error).message, subdomain },
			"Cache write failed",
		);
	}
}

/**
 * Drop every cached response for a subdomain. Called when a tunnel opens a fresh
 * session so a restarted local app never serves stale assets.
 */
export async function purgeSubdomain(subdomain: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;
	const match = `${KEY_PREFIX}:${subdomain}:*`;
	try {
		let cursor = "0";
		let removed = 0;
		do {
			const [next, keys] = await redis.scan(
				cursor,
				"MATCH",
				match,
				"COUNT",
				200,
			);
			cursor = next;
			if (keys.length > 0) {
				await redis.unlink(...keys);
				removed += keys.length;
			}
		} while (cursor !== "0");
		if (removed > 0)
			logger.info({ subdomain, removed }, "Purged subdomain cache");
	} catch (err) {
		logger.warn(
			{ err: (err as Error).message, subdomain },
			"Cache purge failed",
		);
	}
}
