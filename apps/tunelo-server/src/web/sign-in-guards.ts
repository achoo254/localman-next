import type { RequestHandler } from "express";
import { AttemptLimiter } from "../lib/attempt-limiter.js";

/** Pending sign-ins remembered at most; the oldest go first past it. */
export const MAX_PENDING_SIGN_INS = 10_000;
/** `/auth/login` and `/auth/callback` calls per client IP and minute. */
export const SIGN_IN_LIMIT_PER_MINUTE = 20;

/**
 * Sign-ins started here and not finished yet, by `state`. The sealed cookie
 * alone would let one captured callback be replayed for its whole lifetime,
 * each replay costing a call to the IdP token endpoint; consuming the state
 * here first makes every transaction single-use. In memory: the server runs
 * as one process, and a restart only cancels sign-ins in progress.
 */
export class PendingSignIns {
	private readonly pending = new Map<string, number>();

	constructor(
		private readonly maxSize = MAX_PENDING_SIGN_INS,
		private readonly now: () => number = Date.now,
	) {}

	/** Remembers a new sign-in until `expiresAt` (epoch ms). */
	add(state: string, expiresAt: number): void {
		if (this.pending.size >= this.maxSize) this.sweep();
		// Still full: drop the oldest (Map keeps insertion order).
		while (this.pending.size >= this.maxSize) {
			const oldest = this.pending.keys().next();
			if (oldest.done) break;
			this.pending.delete(oldest.value);
		}
		this.pending.set(state, expiresAt);
	}

	/** True exactly once for a live sign-in; unknown, used or expired ⟹ false. */
	consume(state: string): boolean {
		const expiresAt = this.pending.get(state);
		if (expiresAt === undefined) return false;
		this.pending.delete(state);
		return expiresAt > this.now();
	}

	get size(): number {
		return this.pending.size;
	}

	private sweep(): void {
		const at = this.now();
		for (const [state, expiresAt] of this.pending) {
			if (expiresAt <= at) this.pending.delete(state);
		}
	}
}

/**
 * Per client IP limit (`req.ip`, which honours `trust proxy`: behind nginx
 * it is the real client). Answers 429 once the window is used up.
 */
export function ipRateLimit(limitPerMinute: number): RequestHandler {
	const limiter = new AttemptLimiter(limitPerMinute, 60_000);
	return (req, res, next) => {
		const key = req.ip ?? "unknown";
		if (limiter.isBlocked(key)) {
			res
				.status(429)
				.set({ "retry-after": "60", "cache-control": "no-store" })
				.type("text/plain")
				.send("Too many sign-in attempts. Try again in a minute.");
			return;
		}
		limiter.hit(key);
		next();
	};
}
