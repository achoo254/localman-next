import type { Logger } from "../../logger.js";
import {
	incrementUsage,
	readUsage,
	yyyymmOf,
} from "../billing/usage-counter-model.js";
import { ProjectActivity } from "./project-activity.js";
import { type QuotaWarning, crossedThresholds } from "./quota-warnings.js";

/** How often counted requests are written to `usage_counters`. */
export const USAGE_FLUSH_INTERVAL_MS = 5_000;
/** Owners idle this long are dropped from memory (re-read on return). */
const IDLE_MS = 10 * 60_000;

interface OwnerMonth {
	readonly owner: string;
	/** An instant inside the month, for `incrementUsage`. */
	readonly at: Date;
	/** Total stored in `usage_counters` at the last read or flush. */
	stored: number;
	/** Counted here, not yet sent. */
	pending: number;
	/** Being sent by the running flush. */
	sending: number;
	/** Monthly limit seen with the latest request (`null`: none). */
	limit: number | null;
	lastSeen: number;
}

export interface UsageMeterOptions {
	readonly logger: Logger;
	/** Sends the 80% / 100% warning; failures are logged by the meter. */
	readonly warn: (owner: string, warning: QuotaWarning) => Promise<void>;
	readonly now?: () => Date;
}

/**
 * Monthly mock request quota of project owners. Requests are counted in
 * memory and added to the owner's `usage_counters` document every 5
 * seconds (and on shutdown) with one atomic `$inc`, so the hot path never
 * writes to Mongo. Admission compares the stored total plus what this
 * process counted with the plan's `mockRequestsPerMonth`. One process
 * serves the mock runtime; with several, each would admit up to the
 * last total it read (an overshoot bounded by one flush interval).
 *
 * Warnings at 80% and 100% are sent when a flush's `$inc` moves the
 * stored total across the threshold. Each `$inc` covers a disjoint
 * range of the counter, so every threshold is crossed once a month.
 * Admitted requests are also counted per project (`ProjectActivity`).
 */
export class UsageMeter {
	/** Loaded months; only touched synchronously, so admits never race it. */
	private readonly months = new Map<string, OwnerMonth>();
	private readonly loading = new Map<string, Promise<OwnerMonth>>();
	private timer: NodeJS.Timeout | undefined;
	private flushing: Promise<void> | undefined;
	private flushAgain: Promise<void> | undefined;
	private readonly now: () => Date;
	private readonly activity: ProjectActivity;

	constructor(private readonly options: UsageMeterOptions) {
		this.now = options.now ?? (() => new Date());
		this.activity = new ProjectActivity(options.logger);
	}

	/** Counts a request of `owner` and `projectId`; false once `limit` is hit. */
	async admit(
		owner: string,
		limit: number | null,
		projectId?: string,
	): Promise<boolean> {
		const at = this.now();
		const key = `${owner}:${yyyymmOf(at)}`;
		const loaded = this.months.get(key) ?? (await this.load(key, owner, at));
		// From here on nothing awaits: the entry counted is the one a flush
		// sees. If a flush dropped it while this call waited, it comes back.
		const month = this.months.get(key) ?? loaded;
		this.months.set(key, month);
		month.limit = limit;
		month.lastSeen = at.getTime();
		const used = month.stored + month.sending + month.pending;
		if (limit !== null && used >= limit) return false;
		month.pending += 1;
		if (projectId !== undefined) this.activity.record(projectId, at);
		return true;
	}

	/** Reads the stored month once; concurrent first requests share it. */
	private load(key: string, owner: string, at: Date): Promise<OwnerMonth> {
		const known = this.loading.get(key);
		if (known) return known;
		const loading = readUsage(owner, at)
			.then(
				(totals): OwnerMonth => ({
					owner,
					at,
					stored: totals.mockRequests,
					pending: 0,
					sending: 0,
					limit: null,
					lastSeen: at.getTime(),
				}),
			)
			.finally(() => this.loading.delete(key));
		this.loading.set(key, loading);
		return loading;
	}

	/**
	 * Writes every pending count. A call during a running flush waits for
	 * it and then flushes once more (counts added meanwhile are written);
	 * calls during that wait share the second run.
	 */
	flush(): Promise<void> {
		if (this.flushing) {
			this.flushAgain ??= this.flushing.then(() => {
				this.flushAgain = undefined;
				return this.flush();
			});
			return this.flushAgain;
		}
		this.flushing = this.flushAll().finally(() => {
			this.flushing = undefined;
		});
		return this.flushing;
	}

	private async flushAll(): Promise<void> {
		await this.activity.flush();
		for (const month of [...this.months.values()]) {
			if (month.pending > 0) await this.send(month);
		}
		// Synchronous with admits: an entry dropped here has nothing pending.
		const now = this.now().getTime();
		const currentMonth = yyyymmOf(this.now());
		for (const [key, month] of this.months) {
			const stale =
				now - month.lastSeen > IDLE_MS || yyyymmOf(month.at) !== currentMonth;
			if (stale && month.pending === 0 && month.sending === 0) {
				this.months.delete(key);
			}
		}
	}

	private async send(month: OwnerMonth): Promise<void> {
		const by = month.pending;
		month.pending = 0;
		month.sending += by;
		let total: number;
		try {
			total = await incrementUsage(month.owner, "mockRequests", by, month.at);
		} catch (error) {
			month.sending -= by;
			month.pending += by;
			this.options.logger.error({ err: error }, "Mock usage flush failed");
			return;
		}
		// Moved from "sending" to "stored" at once, so admits never count it twice.
		month.sending -= by;
		month.stored = total;
		await this.warnCrossed(month, total - by, total);
	}

	private async warnCrossed(
		month: OwnerMonth,
		before: number,
		after: number,
	): Promise<void> {
		for (const threshold of crossedThresholds(month.limit, before, after)) {
			try {
				await this.options.warn(month.owner, {
					threshold,
					limit: month.limit ?? 0,
					month: yyyymmOf(month.at),
				});
			} catch (error) {
				this.options.logger.error(
					{ err: error, threshold },
					"Quota warning failed",
				);
			}
		}
	}

	/** Flushes every `USAGE_FLUSH_INTERVAL_MS` until `stop`. */
	start(intervalMs = USAGE_FLUSH_INTERVAL_MS): void {
		if (this.timer) return;
		this.timer = setInterval(() => void this.flush(), intervalMs);
		this.timer.unref();
	}

	/** Shutdown: stops the timer, then flushes (after a running flush). */
	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		await this.flush();
	}
}
