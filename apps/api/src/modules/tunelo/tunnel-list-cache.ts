import { tenantKey } from "../../tenancy/tenant-context.js";
import type { LocalTunnelList } from "./tunelo-view.js";

/** How long a user's merged tunnel list is reused. */
export const TUNNEL_LIST_TTL_MS = 10_000;
/** A refresh ("Check again") waits until the list is this old. */
export const TUNNEL_REFRESH_MIN_MS = 2_000;

interface Entry {
	readonly list: LocalTunnelList;
	readonly at: number;
}

/**
 * Merged tunnel list per user (and tenant), reused for 10 seconds: a send
 * to a local address asks for it, and Tunelo is called once per source
 * per window instead of once per request. Concurrent loads of one user
 * share a single fetch. Linking or revoking a machine drops the entry.
 */
export class TunnelListCache {
	private readonly entries = new Map<string, Entry>();
	private readonly loading = new Map<string, Promise<LocalTunnelList>>();

	constructor(private readonly now: () => number = Date.now) {}

	/** The list if younger than `maxAgeMs` (the full TTL by default). */
	get(userSub: string, maxAgeMs = TUNNEL_LIST_TTL_MS): LocalTunnelList | null {
		const entry = this.entries.get(tenantKey(userSub));
		if (!entry || this.now() - entry.at >= maxAgeMs) return null;
		return entry.list;
	}

	/** Milliseconds since the user's list was kept; null when there is none. */
	age(userSub: string): number | null {
		const entry = this.entries.get(tenantKey(userSub));
		return entry ? this.now() - entry.at : null;
	}

	/** Runs `fetch` and keeps its list, or joins the one already running. */
	load(
		userSub: string,
		fetch: () => Promise<LocalTunnelList>,
	): Promise<LocalTunnelList> {
		const key = tenantKey(userSub);
		const running = this.loading.get(key);
		if (running) return running;
		// A drop (link, revoke) while loading discards this load's list.
		const pending: Promise<LocalTunnelList> = fetch()
			.then((list) => {
				if (this.loading.get(key) === pending) this.set(userSub, list);
				return list;
			})
			.finally(() => {
				if (this.loading.get(key) === pending) this.loading.delete(key);
			});
		this.loading.set(key, pending);
		return pending;
	}

	set(userSub: string, list: LocalTunnelList): void {
		this.prune();
		this.entries.set(tenantKey(userSub), { list, at: this.now() });
	}

	drop(userSub: string): void {
		const key = tenantKey(userSub);
		this.entries.delete(key);
		this.loading.delete(key);
	}

	private prune(): void {
		const now = this.now();
		for (const [key, entry] of this.entries) {
			if (now - entry.at >= TUNNEL_LIST_TTL_MS) this.entries.delete(key);
		}
	}
}
