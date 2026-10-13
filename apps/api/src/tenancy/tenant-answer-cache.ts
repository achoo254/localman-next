import type { Logger } from "../logger.js";
import type { TenantAnswer } from "./idp-tenant-client.js";

/** A found tenant is asked again after this long. */
export const TENANT_FRESH_MS = 60_000;
/** A 404 (no such tenant) is asked again after this long. */
export const MISSING_FRESH_MS = 30_000;
/** Keys kept at most; the oldest answer goes first. */
const MAX_ENTRIES = 1_000;

interface Entry {
	readonly answer: TenantAnswer;
	readonly at: number;
}

/**
 * Answers of the IdP's tenant API by key: fresh ones are reused, one
 * question per key is in flight at a time, and when the IdP fails the
 * last answer is kept (stale-while-error), so tenants already seen keep
 * working while the IdP restarts. Only a real 404 is remembered as "no
 * tenant"; a failure with nothing known throws.
 */
export class TenantAnswerCache {
	private readonly entries = new Map<string, Entry>();
	private readonly loading = new Map<string, Promise<TenantAnswer>>();

	constructor(
		private readonly logger: Logger,
		private readonly now: () => number = Date.now,
	) {}

	get(key: string, load: () => Promise<TenantAnswer>): Promise<TenantAnswer> {
		const entry = this.entries.get(key);
		if (entry && this.isFresh(entry)) return Promise.resolve(entry.answer);
		const running = this.loading.get(key);
		if (running) return running;
		const next = this.refresh(key, entry, load).finally(() => {
			this.loading.delete(key);
		});
		this.loading.set(key, next);
		return next;
	}

	/** Remembers an answer learned another way (a host lookup, by id). */
	set(key: string, answer: TenantAnswer): void {
		this.entries.delete(key);
		this.entries.set(key, { answer, at: this.now() });
		for (const oldest of this.entries.keys()) {
			if (this.entries.size <= MAX_ENTRIES) break;
			this.entries.delete(oldest);
		}
	}

	private isFresh(entry: Entry): boolean {
		const ttl = entry.answer ? TENANT_FRESH_MS : MISSING_FRESH_MS;
		return this.now() - entry.at < ttl;
	}

	private async refresh(
		key: string,
		known: Entry | undefined,
		load: () => Promise<TenantAnswer>,
	): Promise<TenantAnswer> {
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
			return known.answer;
		}
	}
}
