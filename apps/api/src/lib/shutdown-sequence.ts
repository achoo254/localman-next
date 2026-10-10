import { setTimeout as sleep } from "node:timers/promises";

/** One named step of the shutdown. */
export interface ShutdownStep {
	readonly name: string;
	readonly run: () => Promise<unknown>;
}

interface Stoppable {
	stop(): Promise<void>;
}

/** What `main.ts` stops, in the order of `shutdownSteps`. */
export interface ShutdownParts {
	/** Outbound queue: claims nothing more, in-flight attempts go back. */
	readonly outboundQueue: Stoppable;
	/** Ends the live streams (MCP, request log SSE); new ones are refused. */
	readonly closeStreams: () => Promise<void>;
	readonly usageMeter: Stoppable;
	readonly requestLog: Stoppable;
	/** Waits for the HTTP servers to finish their open responses. */
	readonly closeServers: () => Promise<void>;
	/** Background work that may still write (sweeper, notifications). */
	readonly drain: () => Promise<void>;
	readonly disconnect: () => Promise<void>;
}

/**
 * The shutdown order. Nothing new starts first (no job claimed, attempts
 * in flight put back, live streams ended), then the counted requests and
 * the log lines are written, and only then do the servers wait for slow
 * responses (an upstream may hold one 30 s): a shutdown cut by its budget
 * there has already saved the quota counts and the log. Requests served
 * while the servers close are counted and logged again after them.
 */
export function shutdownSteps(parts: ShutdownParts): ShutdownStep[] {
	return [
		{ name: "outbound-queue", run: () => parts.outboundQueue.stop() },
		{ name: "streams", run: parts.closeStreams },
		{ name: "usage-meter", run: () => parts.usageMeter.stop() },
		{ name: "request-log", run: () => parts.requestLog.stop() },
		{ name: "servers", run: parts.closeServers },
		// Enqueues, counts and lines of the responses that ended meanwhile.
		{ name: "outbound-queue-final", run: () => parts.outboundQueue.stop() },
		{ name: "usage-meter-final", run: () => parts.usageMeter.stop() },
		{ name: "request-log-final", run: () => parts.requestLog.stop() },
		{ name: "background", run: parts.drain },
		{ name: "mongo", run: parts.disconnect },
	];
}

export interface ShutdownOutcome {
	/** Every step ran before the budget was spent (some may have failed). */
	readonly finished: boolean;
	/** Steps that threw; the next steps still ran. */
	readonly failed: readonly string[];
	/** The step still running when the budget was spent. */
	readonly cutAt: string | null;
}

/**
 * Runs `steps` in order within `budgetMs` in total. A step that throws is
 * reported (`onError`) and the next one runs; a step still running when
 * the budget is spent ends the sequence there (`cutAt`).
 */
export async function runShutdownSteps(
	steps: readonly ShutdownStep[],
	budgetMs: number,
	onError: (step: string, error: unknown) => void,
): Promise<ShutdownOutcome> {
	const deadline = Date.now() + budgetMs;
	const failed: string[] = [];
	for (const step of steps) {
		const left = deadline - Date.now();
		if (left <= 0) return { finished: false, failed, cutAt: step.name };
		const timer = new AbortController();
		const done = Promise.resolve()
			.then(step.run)
			.then(
				() => "done" as const,
				(error: unknown) => {
					onError(step.name, error);
					failed.push(step.name);
					return "done" as const;
				},
			);
		const late = sleep(left, "late" as const, { signal: timer.signal }).catch(
			() => "done" as const,
		);
		const outcome = await Promise.race([done, late]);
		timer.abort();
		if (outcome === "late")
			return { finished: false, failed, cutAt: step.name };
	}
	return { finished: true, failed, cutAt: null };
}
