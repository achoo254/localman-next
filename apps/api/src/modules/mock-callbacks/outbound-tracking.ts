import { type Logger, createLogger } from "../../logger.js";

/**
 * Enqueues still being written: dispatching runs after the response is
 * sent, so shutdown and tests wait for these before stopping the queue.
 */
const tracked = new Set<Promise<void>>();
let logger: Logger = createLogger("silent");

/** Installed with the queue's logger by `main.ts`. */
export function configureOutboundTracking(next: Logger): void {
	logger = next;
}

/** Runs `work` in the background; its failure is logged, never thrown. */
export function trackOutbound(work: Promise<unknown>): void {
	const done: Promise<void> = work
		.then(() => undefined)
		.catch((error: unknown) => {
			logger.error({ err: error }, "Queueing an outbound delivery failed");
		})
		.finally(() => tracked.delete(done));
	tracked.add(done);
}

/** Resolves once every tracked enqueue has finished. */
export async function settleTracked(): Promise<void> {
	while (tracked.size > 0) await Promise.allSettled([...tracked]);
}
