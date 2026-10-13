import type { Types } from "mongoose";
import {
	currentTenantId,
	runInTenantData,
} from "../../tenancy/tenant-context.js";
import { RequestLogModel } from "./request-log-model.js";

/** Lines a project keeps at most; older ones are deleted past it. */
export const MAX_LINES_PER_PROJECT = 20_000;
/** A project's log is trimmed at most this often (after a flush wrote to it). */
export const TRIM_EVERY_MS = 30_000;

/**
 * Deletes the oldest lines of the project past its newest `max`. The
 * edge is found on the `{ projectId, _id }` index (a covered skip over
 * `max` keys), then everything at or below it goes in one `deleteMany`.
 * Returns the lines deleted.
 */
export async function trimProjectLog(
	projectId: Types.ObjectId,
	max: number = MAX_LINES_PER_PROJECT,
): Promise<number> {
	const edge = await RequestLogModel.findOne({ projectId }, { _id: 1 })
		.sort({ _id: -1 })
		.skip(max)
		.lean<{ _id: Types.ObjectId }>();
	if (!edge) return 0;
	const result = await RequestLogModel.deleteMany({
		projectId,
		_id: { $lte: edge._id },
	});
	return result.deletedCount;
}

/**
 * Projects written since their last trim, trimmed at most every
 * `everyMs` each: a busy project passes its cap by one interval of
 * traffic at most, and a quiet one is not looked at again.
 */
export class LogTrimmer {
	/** Each touched project with its tenant (trimmed in it, on its index). */
	private readonly touched = new Map<
		string,
		{ readonly tenantId: string; readonly projectId: Types.ObjectId }
	>();
	private readonly lastRun = new Map<string, number>();

	constructor(
		private readonly max: number = MAX_LINES_PER_PROJECT,
		private readonly everyMs: number = TRIM_EVERY_MS,
	) {}

	/** The project (of the tenant in scope) got lines in Mongo. */
	note(projectId: Types.ObjectId): void {
		const tenantId = currentTenantId();
		this.touched.set(projectId.toHexString(), { tenantId, projectId });
	}

	/** Trims the touched projects whose interval passed; failures are thrown. */
	async run(now: number = Date.now()): Promise<void> {
		for (const [key, last] of this.lastRun) {
			if (now - last >= this.everyMs) this.lastRun.delete(key);
		}
		for (const [key, { tenantId, projectId }] of this.touched) {
			if (this.lastRun.has(key)) continue;
			this.touched.delete(key);
			this.lastRun.set(key, now);
			await runInTenantData(tenantId, () =>
				trimProjectLog(projectId, this.max),
			);
		}
	}
}
