import type { TenancyLogger } from "./tenancy-logger.js";

/** A found tenant is asked again after this long. */
export const TENANT_FRESH_MS = 60_000;
/** A 404 (no such tenant) is asked again after this long. */
export const MISSING_FRESH_MS = 30_000;
/** After a failed refresh, the last answer is used this long before retrying. */
export const RETRY_MS = 10_000;
/**
 * Answers kept at most, found tenants and 404s apart: hosts anyone can
 * make up only ever push out other 404s, never a tenant's last answer.
 */
const MAX_FOUND = 1_000;
const MAX_MISSING = 1_000;

interface Entry<A> {
	readonly answer: A | undefined;
	readonly freshUntil: number;
}

/**
 * Answers of the IdP's tenant API by key (`undefined`: its 404): fresh ones are reused, one
 * question per key is in flight at a time, and when the IdP fails the
 * last answer is kept (stale-while-error, retried every `RETRY_MS`), so
 * tenants already seen keep working while the IdP restarts. Only a real
 * 404 is remembered as "no tenant"; a failure with nothing known throws.
 */
export class TenantAnswerCache<A> {
	private readonly found = new Map<string, Entry<A>>();
	private readonly missing = new Map<string, Entry<A>>();
	private readonly loading = new Map<string, Promise<A | undefined>>();

	constructor(
		private readonly logger: TenancyLogger,
		private readonly now: () => number = Date.now,
	) {}

	get(key: string, load: () => Promise<A | undefined>): Promise<A | undefined> {
		const entry = this.found.get(key) ?? this.missing.get(key);
		if (entry && this.now() < entry.freshUntil) {
			return Promise.resolve(entry.answer);
		}
		const running = this.loading.get(key);
		if (running) return running;
		const next = this.refresh(key, entry, load).finally(() => {
			this.loading.delete(key);
		});
		this.loading.set(key, next);
		return next;
	}

	/** Remembers an answer learned another way (a host lookup, by id). */
	set(key: string, answer: A | undefined): void {
		const ttl = answer ? TENANT_FRESH_MS : MISSING_FRESH_MS;
		this.store(key, { answer, freshUntil: this.now() + ttl });
	}

	private store(key: string, entry: Entry<A>): void {
		this.found.delete(key);
		this.missing.delete(key);
		const [map, max] = entry.answer
			? [this.found, MAX_FOUND]
			: [this.missing, MAX_MISSING];
		map.set(key, entry);
		for (const oldest of map.keys()) {
			if (map.size <= max) break;
			map.delete(oldest);
		}
	}

	private async refresh(
		key: string,
		known: Entry<A> | undefined,
		load: () => Promise<A | undefined>,
	): Promise<A | undefined> {
		try {
			const answer = await load();
			this.set(key, answer);
			return answer;
		} catch (error) {
			if (!known) {
				this.logger.error({ err: error }, "IdP tenant lookup failed");
				throw error;
			}
			this.logger.warn(
				{ err: error },
				"IdP tenant lookup failed; using the last answer",
			);
			this.store(key, { ...known, freshUntil: this.now() + RETRY_MS });
			return known.answer;
		}
	}
}
