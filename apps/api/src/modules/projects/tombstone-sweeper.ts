import type { Logger } from "../../logger.js";
import { runInPrimaryTenant } from "../../tenancy/primary-tenant-job.js";
import { ProjectModel, type StoredProject } from "./project-model.js";
import { deleteProjectCascade } from "./project-service.js";

/** A tombstone this old belongs to a deletion that failed or was cut off. */
export const TOMBSTONE_GRACE_MS = 5 * 60_000;
export const TOMBSTONE_SWEEP_INTERVAL_MS = 10 * 60_000;
/** Projects finished per sweep; the rest wait for the next one. */
const SWEEP_BATCH = 100;

/**
 * Finishes the deletion of projects whose `deletingAt` is older than the
 * grace period, so a deletion interrupted by an error or a restart does
 * not hold the owner's quota slot forever. `deleteProjectCascade` is
 * idempotent (the tombstone step skips a tombstoned project, cleanups run
 * under the project lock, the last step deletes by id), so a sweep racing
 * a repeated DELETE of the same project is harmless. Returns how many
 * projects were finished; a failure is logged and retried next sweep.
 */
export async function sweepTombstones(
	logger: Logger,
	now: Date = new Date(),
): Promise<number> {
	const before = new Date(now.getTime() - TOMBSTONE_GRACE_MS);
	const stale = await ProjectModel.find({ deletingAt: { $lt: before } })
		.sort({ deletingAt: 1 })
		.limit(SWEEP_BATCH)
		.lean<StoredProject[]>();
	let finished = 0;
	for (const project of stale) {
		const projectId = project._id.toHexString();
		try {
			await deleteProjectCascade(project);
			finished += 1;
			logger.info({ projectId }, "Finished an interrupted project deletion");
		} catch (error) {
			logger.error({ err: error, projectId }, "Tombstone sweep failed");
		}
	}
	return finished;
}

/**
 * Runs `sweepTombstones` at start and then every interval (the timer is
 * `unref`, so it never keeps the process alive). Sweeps never overlap;
 * `stop` clears the timer and waits for a running sweep (shutdown, before
 * Mongo is disconnected).
 */
export class TombstoneSweeper {
	private timer: NodeJS.Timeout | undefined;
	private running: Promise<void> | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly intervalMs = TOMBSTONE_SWEEP_INTERVAL_MS,
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
			sweepTombstones(this.logger),
		)
			.then(
				() => undefined,
				(error: unknown) => {
					this.logger.error({ err: error }, "Tombstone sweep failed");
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
