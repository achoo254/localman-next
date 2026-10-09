import type { Logger } from "../../logger.js";
import {
	type ProjectRequests,
	recordProjectRequests,
} from "../projects/project-model.js";

interface Pending {
	count: number;
	lastAt: Date;
}

/**
 * Mock requests per project, counted in memory and written by `flush`
 * (the usage meter calls it on its 5-second tick and at shutdown) as one
 * bulk write: the project's `mockRequests` total and `lastRequestAt`,
 * which the abandoned-project cleanup reads. A failed write keeps the
 * counts for the next flush.
 */
export class ProjectActivity {
	private pending = new Map<string, Pending>();

	constructor(private readonly logger: Logger) {}

	record(projectId: string, at: Date): void {
		this.add(projectId, 1, at);
	}

	private add(projectId: string, count: number, at: Date): void {
		const entry = this.pending.get(projectId);
		if (!entry) {
			this.pending.set(projectId, { count, lastAt: at });
			return;
		}
		entry.count += count;
		if (at > entry.lastAt) entry.lastAt = at;
	}

	/** Callers serialize flushes (the usage meter does). */
	async flush(): Promise<void> {
		if (this.pending.size === 0) return;
		const batch: ProjectRequests[] = [...this.pending].map(
			([projectId, { count, lastAt }]) => ({ projectId, count, lastAt }),
		);
		// Requests counted while the write runs go to a fresh map.
		this.pending = new Map();
		try {
			await recordProjectRequests(batch);
		} catch (error) {
			for (const { projectId, count, lastAt } of batch) {
				this.add(projectId, count, lastAt);
			}
			this.logger.error({ err: error }, "Project activity flush failed");
		}
	}
}
