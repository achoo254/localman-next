/**
 * Fixed-window counter: at most `limit` hits per key per `windowMs`. Kept in
 * memory, like the tunnel registry (the server runs as one instance).
 */
export class AttemptLimiter {
	private readonly windows = new Map<
		string,
		{ count: number; resetAt: number }
	>();

	constructor(
		private readonly limit: number,
		private readonly windowMs: number,
		private readonly now: () => number = Date.now,
	) {}

	/** True while `key` has used up its window. */
	isBlocked(key: string): boolean {
		const entry = this.windows.get(key);
		if (!entry) return false;
		if (entry.resetAt <= this.now()) {
			this.windows.delete(key);
			return false;
		}
		return entry.count >= this.limit;
	}

	/** Counts one hit; returns true when the key is now blocked. */
	hit(key: string): boolean {
		const at = this.now();
		const entry = this.windows.get(key);
		if (!entry || entry.resetAt <= at) {
			this.prune(at);
			this.windows.set(key, { count: 1, resetAt: at + this.windowMs });
			return this.limit <= 1;
		}
		entry.count++;
		return entry.count >= this.limit;
	}

	reset(key: string): void {
		this.windows.delete(key);
	}

	private prune(at: number): void {
		for (const [key, entry] of this.windows) {
			if (entry.resetAt <= at) this.windows.delete(key);
		}
	}
}
