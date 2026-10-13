import type { Logger } from "../../logger.js";

/** Dropped lines are reported in one warning at most this often. */
const DROP_WARNING_EVERY_MS = 60_000;

/** Lines the request log dropped, reported in one warning a minute at most. */
export class DroppedLines {
	private dropped = 0;
	private lastWarning = 0;

	add(): void {
		this.dropped += 1;
	}

	report(logger: Logger, now = Date.now()): void {
		const quiet = now - this.lastWarning < DROP_WARNING_EVERY_MS;
		if (this.dropped === 0 || quiet) return;
		logger.warn({ lines: this.dropped }, "Request log lines dropped");
		this.dropped = 0;
		this.lastWarning = now;
	}
}
