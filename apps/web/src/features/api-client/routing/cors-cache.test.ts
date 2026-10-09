import { describe, expect, it, vi } from "vitest";
import { CORS_CACHE_TTL_MS, createCorsCache } from "./cors-cache";

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

describe("CORS cache", () => {
	it("remembers an origin until it expires", () => {
		let now = 1_000;
		const cache = createCorsCache({ storage: null, now: () => now });
		cache.remember("https://api.test");
		expect(cache.has("https://api.test")).toBe(true);
		expect(cache.has("https://other.test")).toBe(false);
		now += CORS_CACHE_TTL_MS - 1;
		expect(cache.has("https://api.test")).toBe(true);
		now += 1;
		expect(cache.has("https://api.test")).toBe(false);
		expect(cache.list()).toEqual([]);
	});

	it("keeps entries across page loads and ignores a corrupt store", () => {
		const storage = memoryStorage();
		createCorsCache({ storage }).remember("https://api.test");
		expect(createCorsCache({ storage }).has("https://api.test")).toBe(true);
		storage.setItem("localman-api-client-cors-cache", "{not json");
		expect(createCorsCache({ storage }).list()).toEqual([]);
	});

	it("forgets one origin or all of them, and tells subscribers", () => {
		const cache = createCorsCache({ storage: memoryStorage() });
		const listener = vi.fn();
		cache.subscribe(listener);
		cache.remember("https://a.test");
		cache.remember("https://b.test");
		const snapshot = cache.list();
		expect(cache.list()).toBe(snapshot);
		cache.forget("https://a.test");
		expect(cache.list().map((entry) => entry.origin)).toEqual([
			"https://b.test",
		]);
		cache.clear();
		expect(cache.list()).toEqual([]);
		expect(listener).toHaveBeenCalledTimes(4);
	});
});
