/**
 * Most requests of one project that may be waiting on chaos at once.
 * Each holds a socket (a timeout for 30 s), so the cap keeps one project
 * from pinning the process's connections.
 */
export const MAX_DELAYED_PER_PROJECT = 50;

export type DelayOutcome = "done" | "aborted" | "busy";

/**
 * Resolves after `ms` on a timer (the event loop keeps serving), or as
 * soon as `signal` aborts (the timer is cleared).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
	if (signal?.aborted) return Promise.resolve(false);
	return new Promise((resolve) => {
		const onAbort = () => {
			clearTimeout(timer);
			resolve(false);
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve(true);
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * Counts the chaos waits in flight per project. A wait over the cap is
 * not started (`busy`); the caller answers it at once instead of
 * holding another connection.
 */
export class DelayGate {
	private readonly waiting = new Map<string, number>();

	constructor(private readonly maxPerProject = MAX_DELAYED_PER_PROJECT) {}

	async wait(
		projectId: string,
		ms: number,
		signal?: AbortSignal,
	): Promise<DelayOutcome> {
		if (ms <= 0) return signal?.aborted ? "aborted" : "done";
		const current = this.waiting.get(projectId) ?? 0;
		if (current >= this.maxPerProject) return "busy";
		this.waiting.set(projectId, current + 1);
		try {
			return (await sleep(ms, signal)) ? "done" : "aborted";
		} finally {
			const left = (this.waiting.get(projectId) ?? 1) - 1;
			if (left > 0) this.waiting.set(projectId, left);
			else this.waiting.delete(projectId);
		}
	}

	/** Waits in flight for `projectId`. */
	inFlight(projectId: string): number {
		return this.waiting.get(projectId) ?? 0;
	}
}
