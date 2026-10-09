/**
 * Least-recently-used cache whose entries also expire `ttlMs` after they
 * were stored. A `Map` keeps insertion order, so re-inserting on a hit
 * moves the key to the back and the front is always the eviction victim.
 */
export class TtlLruCache<V> {
	private readonly entries = new Map<string, { value: V; expiresAt: number }>();

	constructor(
		private readonly maxEntries: number,
		private readonly ttlMs: number,
		private readonly now: () => number = Date.now,
	) {}

	get(key: string): V | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		this.entries.delete(key);
		if (entry.expiresAt <= this.now()) return undefined;
		this.entries.set(key, entry);
		return entry.value;
	}

	set(key: string, value: V): void {
		this.entries.delete(key);
		this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
	}

	delete(key: string): void {
		this.entries.delete(key);
	}

	clear(): void {
		this.entries.clear();
	}

	get size(): number {
		return this.entries.size;
	}
}
