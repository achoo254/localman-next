import { createHash } from "node:crypto";
import { createLogger } from "../logger.js";
import { currentTenantId } from "../tenancy/tunnel-tenant.js";
import { getRedis } from "./redis-client.js";

const logger = createLogger("tunelo-cache");

export interface CachedResponse {
	readonly status: number;
	readonly headers: Record<string, string | string[]>;
	/** Response body, base64-encoded. */
	readonly body: string;
}

const KEY_PREFIX = "tunelo:cache";

/** Cache key prefix of a subdomain in the tenant in scope (the same
 *  subdomain on another tenant's domain is another app). */
function prefixFor(subdomain: string): string {
	return `${KEY_PREFIX}:${currentTenantId()}:${subdomain}`;
}

/** Key isolates by tenant, subdomain and content-encoding variant, then hashes
 *  the path (bounds length, keeps query strings out of logs). Variant sits
 *  before the hash so per-subdomain purge (`{prefix}:*`) still matches. */
function keyFor(subdomain: string, variant: string, path: string): string {
	const hash = createHash("sha1").update(path).digest("hex");
	return `${prefixFor(subdomain)}:${variant}:${hash}`;
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
 * Drop every cached response for a subdomain of the tenant in scope. Called when a tunnel opens a fresh
 * session so a restarted local app never serves stale assets.
 */
export async function purgeSubdomain(subdomain: string): Promise<void> {
	const redis = getRedis();
	if (!redis) return;
	const match = `${prefixFor(subdomain)}:*`;
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
