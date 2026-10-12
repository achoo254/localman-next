import type { Logger } from "../../logger.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { foldSearchText } from "./search-text.js";

/** Examples given a folded name per round. */
const BACKFILL_BATCH = 500;

interface UnfoldedExample {
	readonly _id: unknown;
	readonly name: string;
}

/**
 * Gives the examples saved before examples kept a folded name
 * (`searchName`) one, so the sidebar search finds them through its index,
 * accents ignored. Runs once at start, in rounds of `BACKFILL_BATCH`;
 * idempotent (only examples still without one, each write guarded the same
 * way), so a restart midway or a second instance is harmless. A failure is
 * logged and the next start resumes. Returns how many were filled.
 */
export async function backfillExampleSearchNames(
	logger: Logger,
): Promise<number> {
	const missing = { kind: "example", searchName: { $exists: false } } as const;
	let filled = 0;
	try {
		for (;;) {
			const rows = await CollectionNodeModel.find(missing, { name: 1 })
				.limit(BACKFILL_BATCH)
				.lean<UnfoldedExample[]>();
			if (rows.length === 0) break;
			const result = await CollectionNodeModel.bulkWrite(
				rows.map((row) => ({
					updateOne: {
						filter: { _id: row._id, ...missing },
						update: { $set: { searchName: foldSearchText(row.name) } },
					},
				})),
				{ ordered: false },
			);
			filled += result.modifiedCount;
			if (rows.length < BACKFILL_BATCH) break;
		}
	} catch (error) {
		logger.error(
			{ err: error, filled },
			"Example search names backfill failed",
		);
		return filled;
	}
	if (filled > 0) logger.info({ filled }, "Backfilled example search names");
	return filled;
}
