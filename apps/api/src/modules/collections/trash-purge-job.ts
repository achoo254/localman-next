import type { Logger } from "../../logger.js";
import { forEachTenant } from "../../tenancy/each-tenant.js";
import { CollectionModel } from "./collection-model.js";
import type { StoredCollection } from "./collection-model.js";
import { TRASH_RETENTION_DAYS } from "./trash-access.js";
import { purgeCollection } from "./trash-purge.js";

export const TRASH_PURGE_INTERVAL_MS = 60 * 60_000;
/** Collections purged per run; the rest wait for the next one. */
const PURGE_BATCH = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes for good the collections trashed more than
 * `TRASH_RETENTION_DAYS` ago, oldest first. A failure is logged and
 * retried next run. Returns how many were purged.
 */
export async function purgeExpiredTrash(
	logger: Logger,
	now: Date = new Date(),
): Promise<number> {
	const expired = {
		deletedAt: { $lt: new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS) },
	};
	const rows = await CollectionModel.find(expired, { _id: 1 })
		.sort({ deletedAt: 1 })
		.limit(PURGE_BATCH)
		.lean<Pick<StoredCollection, "_id">[]>();
	let purged = 0;
	for (const row of rows) {
		const collectionId = row._id.toHexString();
		try {
			if (await purgeCollection(row._id, expired)) purged += 1;
		} catch (error) {
			logger.error({ err: error, collectionId }, "Trash purge failed");
		}
	}
	if (purged > 0)
		logger.info({ purged }, "Purged expired collections from the trash");
	return purged;
}

/**
 * Runs `purgeExpiredTrash` at start and then every interval (the timer is
 * `unref`, so it never keeps the process alive). Runs never overlap;
 * `stop` clears the timer and waits for a running purge (shutdown, before
 * Mongo is disconnected).
 */
export class CollectionTrashJob {
	private timer: NodeJS.Timeout | undefined;
	private running: Promise<void> | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly intervalMs = TRASH_PURGE_INTERVAL_MS,
	) {}

	start(): void {
		if (this.timer) return;
		this.run();
		this.timer = setInterval(() => this.run(), this.intervalMs);
		this.timer.unref();
	}

	private run(): void {
		if (this.running) return;
		this.running = forEachTenant(this.logger, () =>
			purgeExpiredTrash(this.logger),
		)
			.then(
				() => undefined,
				(error: unknown) => {
					this.logger.error({ err: error }, "Trash purge failed");
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
