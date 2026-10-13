export type RateDecision =
	| { readonly ok: true }
	| { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Fixed-window counters kept in this process's memory. The mock runtime
 * runs as one process (PM2 fork mode); with several, each would allow
 * the full rate, which is acceptable at this stage (Mongo windows like
 * the feedback form would cost a write per mock request). A window
 * counts hits (`take`) or any amount such as bytes (`add`). Windows of
 * other keys are swept once per window, so memory follows the number of
 * clients active in the last window.
 */
export class WindowRateLimiter {
	private readonly windows = new Map<string, { start: number; used: number }>();
	private sweptAt = 0;

	constructor(
		private readonly max: number,
		private readonly windowMs = 1000,
		private readonly now: () => number = Date.now,
	) {}

	private windowOf(key: string): { start: number; used: number } {
		const now = this.now();
		const start = now - (now % this.windowMs);
		if (start > this.sweptAt) {
			this.sweptAt = start;
			for (const [other, window] of this.windows) {
				if (window.start < start) this.windows.delete(other);
			}
		}
		let window = this.windows.get(key);
		if (!window || window.start !== start) {
			window = { start, used: 0 };
			this.windows.set(key, window);
		}
		return window;
	}

	private refuse(start: number): RateDecision {
		const wait = (start + this.windowMs - this.now()) / 1000;
		return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(wait)) };
	}

	/** Counts one hit; refused once the window holds more than `max`. */
	take(key: string): RateDecision {
		const window = this.windowOf(key);
		window.used += 1;
		return window.used <= this.max ? { ok: true } : this.refuse(window.start);
	}

	/** Refused while the window's amount has reached `max` (see `add`). */
	check(key: string): RateDecision {
		const window = this.windowOf(key);
		return window.used < this.max ? { ok: true } : this.refuse(window.start);
	}

	/** Adds an amount (bytes sent) to the current window. */
	add(key: string, amount: number): void {
		this.windowOf(key).used += amount;
	}

	get size(): number {
		return this.windows.size;
	}
}
