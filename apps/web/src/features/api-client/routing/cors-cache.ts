/**
 * Origins that recently failed a direct send from this browser (usually
 * CORS) while the proxy or a tunnel reached them. Auto mode goes straight
 * to the proxy for them until the entry expires, so the failed attempt is
 * not paid on every send, yet a target that adds CORS later is tried
 * directly again. Kept in this browser only: what the browser may send
 * depends on the browser (permissions, extensions), not on the account.
 */

/** How long an origin stays "needs the proxy". */
export const CORS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Oldest entries go first past this many origins. */
export const CORS_CACHE_MAX_ENTRIES = 200;
const STORAGE_KEY = "localman-api-client-cors-cache";

export interface CorsCacheEntry {
	origin: string;
	/** Epoch milliseconds. */
	expiresAt: number;
}

export interface CorsCache {
	has: (origin: string) => boolean;
	remember: (origin: string) => void;
	forget: (origin: string) => void;
	clear: () => void;
	/** Live entries, soonest to expire first. Same array until a change. */
	list: () => readonly CorsCacheEntry[];
	subscribe: (listener: () => void) => () => void;
}

export interface CorsCacheOptions {
	storage?: Storage | null;
	now?: () => number;
	ttlMs?: number;
}

function defaultStorage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

function isEntry(value: unknown): value is CorsCacheEntry {
	if (typeof value !== "object" || value === null) return false;
	const origin: unknown = Reflect.get(value, "origin");
	const expiresAt: unknown = Reflect.get(value, "expiresAt");
	return typeof origin === "string" && typeof expiresAt === "number";
}

function load(storage: Storage | null): CorsCacheEntry[] {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
	} catch {
		return [];
	}
}

export function createCorsCache(options: CorsCacheOptions = {}): CorsCache {
	const storage =
		options.storage === undefined ? defaultStorage() : options.storage;
	const now = options.now ?? Date.now;
	const ttl = options.ttlMs ?? CORS_CACHE_TTL_MS;
	const listeners = new Set<() => void>();
	let entries = load(storage);

	const live = (): CorsCacheEntry[] => {
		const at = now();
		const kept = entries.filter((entry) => entry.expiresAt > at);
		if (kept.length !== entries.length) entries = kept;
		return entries;
	};
	const commit = (next: CorsCacheEntry[]): void => {
		entries = next;
		try {
			storage?.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Storage full or blocked: the cache still works for this page.
		}
		for (const listener of listeners) listener();
	};

	return {
		has: (origin) => live().some((entry) => entry.origin === origin),
		remember(origin) {
			const others = live().filter((entry) => entry.origin !== origin);
			const next = [...others, { origin, expiresAt: now() + ttl }];
			commit(next.slice(-CORS_CACHE_MAX_ENTRIES));
		},
		forget(origin) {
			commit(live().filter((entry) => entry.origin !== origin));
		},
		clear: () => commit([]),
		list: live,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

let shared: CorsCache | null = null;

/** The page's cache: the router fills it, Routing settings shows and clears it. */
export function browserCorsCache(): CorsCache {
	shared ??= createCorsCache();
	return shared;
}
