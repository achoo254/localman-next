import { OperationError } from "@localman/operations";
import { clientIpBucket } from "../../lib/rate-limit-windows.js";

/** Calls per client address and minute to the public fake data API. */
export const FAKE_DATA_LIMIT_PER_MINUTE = 30;

const WINDOW_MS = 60_000;
/**
 * Addresses tracked at once. Past it, expired windows go first, then the
 * oldest, so a flood from many addresses cannot grow memory without end.
 */
const MAX_TRACKED = 50_000;

interface HitWindow {
	hits: number;
	resetAt: number;
}

/**
 * Fixed one-minute windows per client address (an IPv6 /64 counts as one,
 * like the other limits), kept in memory: the API stores nothing, so its
 * limit does not write to MongoDB either. Shared by every tenant, as
 * per-IP limits are (ADR-0003). Throws 429 `RATE_LIMITED` past `limit`.
 */
export function createIpMinuteLimiter(
	limit: number,
	now: () => number = Date.now,
): (clientIp: string | null) => void {
	const windows = new Map<string, HitWindow>();
	const makeRoom = (at: number) => {
		for (const [key, window] of windows) {
			if (window.resetAt <= at) windows.delete(key);
		}
		for (const key of windows.keys()) {
			if (windows.size < MAX_TRACKED) break;
			windows.delete(key);
		}
	};
	return (clientIp) => {
		const at = now();
		const key = clientIpBucket(clientIp);
		let window = windows.get(key);
		if (!window || window.resetAt <= at) {
			windows.delete(key);
			if (windows.size >= MAX_TRACKED) makeRoom(at);
			window = { hits: 0, resetAt: at + WINDOW_MS };
			windows.set(key, window);
		}
		window.hits += 1;
		if (window.hits > limit) {
			throw new OperationError(
				429,
				"RATE_LIMITED",
				"Too many requests; try again in a minute",
			);
		}
	};
}
