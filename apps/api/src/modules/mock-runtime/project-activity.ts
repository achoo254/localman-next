import { groupByTenant } from "@localman/tenancy";
import type { Logger } from "../../logger.js";
import {
	type LocalmanTenant,
	runInTenant,
} from "../../tenancy/tenant-context.js";
import {
	type ProjectRequests,
	recordProjectRequests,
} from "../projects/project-model.js";

interface Pending {
	readonly tenant: LocalmanTenant;
	readonly projectId: string;
	count: number;
	lastAt: Date;
}

/**
 * Mock requests per project, counted in memory and written by `flush`
 * (the usage meter calls it on its 5-second tick and at shutdown) as one
 * bulk write: the project's `mockRequests` total and `lastRequestAt`,
 * which the abandoned-project cleanup reads. A failed write keeps the
 * counts for the next flush. Each tenant's projects are written in that
 * tenant (the flush runs on a timer, outside any request).
 */
export class ProjectActivity {
	private pending = new Map<string, Pending>();

	constructor(private readonly logger: Logger) {}

	record(tenant: LocalmanTenant, projectId: string, at: Date): void {
		this.add({ tenant, projectId, count: 1, lastAt: at });
	}

	private add(counted: Pending): void {
		const key = `${counted.tenant.id}:${counted.projectId}`;
		const entry = this.pending.get(key);
		if (!entry) {
			this.pending.set(key, { ...counted });
			return;
		}
		entry.count += counted.count;
		if (counted.lastAt > entry.lastAt) entry.lastAt = counted.lastAt;
	}

	/** Callers serialize flushes (the usage meter does). */
	async flush(): Promise<void> {
		if (this.pending.size === 0) return;
		const groups = groupByTenant(this.pending.values());
		// Requests counted while the writes run go to a fresh map.
		this.pending = new Map();
		for (const { tenant, entries } of groups) {
			const batch: ProjectRequests[] = entries.map(
				({ projectId, count, lastAt }) => ({ projectId, count, lastAt }),
			);
			try {
				await runInTenant(tenant, () => recordProjectRequests(batch));
			} catch (error) {
				for (const entry of entries) this.add(entry);
				this.logger.error({ err: error }, "Project activity flush failed");
			}
		}
	}
}
