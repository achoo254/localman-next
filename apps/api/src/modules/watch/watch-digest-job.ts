import type { Logger } from "../../logger.js";
import { runInPrimaryTenant } from "../../tenancy/primary-tenant-job.js";
import { digestWatches } from "./watch-digest.js";

export const WATCH_DIGEST_INTERVAL_MS = 60_000;

/**
 * Runs `digestWatches` at start and then every interval
 * (the timer is `unref`, so it never keeps the process alive). Runs never
 * overlap; `stop` clears the timer and waits for a running digest.
 */
export class WatchDigestJob {
	private timer: NodeJS.Timeout | undefined;
	private running: Promise<void> | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly intervalMs = WATCH_DIGEST_INTERVAL_MS,
	) {}

	start(): void {
		if (this.timer) return;
		this.run();
		this.timer = setInterval(() => this.run(), this.intervalMs);
		this.timer.unref();
	}

	private run(): void {
		if (this.running) return;
		this.running = runInPrimaryTenant(this.logger, () =>
			digestWatches(this.logger),
		)
			.then(
				() => undefined,
				(error: unknown) => {
					this.logger.error({ err: error }, "Watch digest failed");
				},
			)
			.finally(() => {
				this.running = undefined;
			});
	}

	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		await this.running;
	}
}
