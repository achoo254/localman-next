import { OperationError } from "@localman/operations";
import { clientIpBucket } from "../../lib/rate-limit-windows.js";

/** Calls per client address and minute to the public fake data API. */
export const FAKE_DATA_LIMIT_PER_MINUTE = 30;

const WINDOW_MS = 60_000;
/** Addresses tracked at once, so a flood from many cannot grow memory. */
const MAX_TRACKED = 50_000;

interface HitWindow {
	hits: number;
	resetAt: number;
}

export interface IpMinuteLimiterOptions {
	readonly now?: () => number;
	/** Addresses tracked at once; tests pass a small one. */
	readonly maxTracked?: number;
}

/**
 * Fixed one-minute windows per client address (an IPv6 /64 counts as one,
 * like the other limits), kept in memory: the API stores nothing, so its
 * limit does not write to MongoDB either. Shared by every tenant, as
 * per-IP limits are (ADR-0003). Past `limit`, throws 429 `RATE_LIMITED`
 * with `details.retryAfterSeconds`, which the error handler turns into
 * `Retry-After`.
 */
export function createIpMinuteLimiter(
	limit: number,
	{ now = Date.now, maxTracked = MAX_TRACKED }: IpMinuteLimiterOptions = {},
): (clientIp: string | null) => void {
	// A new window is always deleted and set again, so the map's order is
	// the order windows opened in, which is the order they expire in.
	const windows = new Map<string, HitWindow>();
	// Past the cap with every window live, the oldest 1% go at once, so the
	// next new addresses do not each pay for an eviction.
	const batch = Math.max(1, Math.ceil(maxTracked / 100));
	const makeRoom = (at: number) => {
		for (const [key, window] of windows) {
			if (window.resetAt > at) break;
			windows.delete(key);
		}
		if (windows.size < maxTracked) return;
		let left = batch;
		for (const key of windows.keys()) {
			if (left === 0) break;
			windows.delete(key);
			left -= 1;
		}
	};
	return (clientIp) => {
		const at = now();
		const key = clientIpBucket(clientIp);
		let window = windows.get(key);
		if (!window || window.resetAt <= at) {
			windows.delete(key);
			if (windows.size >= maxTracked) makeRoom(at);
			window = { hits: 0, resetAt: at + WINDOW_MS };
			windows.set(key, window);
		}
		window.hits += 1;
		if (window.hits > limit) {
			throw new OperationError(
				429,
				"RATE_LIMITED",
				"Too many requests; try again in a minute",
				{
					retryAfterSeconds: Math.max(
						1,
						Math.ceil((window.resetAt - at) / 1000),
					),
				},
			);
		}
	};
}
