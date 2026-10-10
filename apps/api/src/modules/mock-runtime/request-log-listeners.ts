import type { StoredRequestLog } from "./request-log-model.js";

/** Called with every recorded line of the subscribed project. */
export type LogListener = (line: StoredRequestLog) => void;

/**
 * Live subscribers of the request log (SSE streams) by project. A
 * listener that throws is reported to `onError` and the others still run.
 */
export class LogListeners {
	private readonly byProject = new Map<string, Set<LogListener>>();

	constructor(private readonly onError: (error: unknown) => void) {}

	publish(line: StoredRequestLog): void {
		const listeners = this.byProject.get(line.projectId.toHexString());
		for (const listener of listeners ?? []) {
			try {
				listener(line);
			} catch (error) {
				this.onError(error);
			}
		}
	}

	/** Live lines of one project; returns the unsubscribe function. */
	subscribe(projectId: string, listener: LogListener): () => void {
		const set = this.byProject.get(projectId) ?? new Set<LogListener>();
		set.add(listener);
		this.byProject.set(projectId, set);
		return () => {
			set.delete(listener);
			if (set.size === 0) this.byProject.delete(projectId);
		};
	}
}
