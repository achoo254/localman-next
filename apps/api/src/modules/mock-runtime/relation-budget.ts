import { MAX_RECORD_BYTES, MAX_RESOURCE_BYTES } from "@localman/shared";
import type { ClientSession, Types } from "mongoose";
import { recordBytes } from "../resources/data-size.js";
import { RecordModel, type StoredRecord } from "../resources/record-model.js";
import type { StoredResource } from "../resources/resource-model.js";
import { MAX_RESPONSE_BYTES, responseTooLarge } from "./render-response.js";

/** Records a relation source reads; built from system columns only. */
export interface RelationQuery {
	readonly resource: StoredResource;
	readonly filter: {
		readonly resourceId: Types.ObjectId;
		readonly id?: { readonly $in: readonly string[] };
		readonly parentRecordId?: { readonly $in: readonly string[] };
	};
	/** Records it can match at most (ids asked for), or `Infinity`. */
	readonly maxRecords: number;
	/** Relation fields filled from it: each embeds its records once more. */
	readonly weight: number;
}

/**
 * Most bytes `query` can read: the source's `dataBytes`, or the cap for
 * a resource never measured, and no more than its records could hold.
 */
function boundOf(query: RelationQuery): number {
	const stored = query.resource.dataBytes ?? MAX_RESOURCE_BYTES;
	return Math.min(stored, query.maxRecords * MAX_RECORD_BYTES);
}

function findRecords(query: RelationQuery, session: ClientSession | null) {
	return RecordModel.find(query.filter)
		.select("id parentRecordId data")
		.sort({ _id: 1 })
		.session(session);
}

/**
 * Reads the records of one source, charging each against `budget.left`
 * as many times as fields embed it, and stops with 422
 * `RESPONSE_TOO_LARGE` as soon as the budget is spent: memory stays
 * near the cap whatever the source holds.
 */
async function readWithin(
	query: RelationQuery,
	session: ClientSession | null,
	budget: { left: number },
): Promise<StoredRecord[]> {
	const records: StoredRecord[] = [];
	const cursor = findRecords(query, session).lean<StoredRecord>().cursor();
	try {
		for await (const record of cursor) {
			budget.left -= query.weight * recordBytes(record);
			if (budget.left < 0) {
				throw responseTooLarge(MAX_RESPONSE_BYTES - budget.left);
			}
			records.push(record);
		}
	} finally {
		await cursor.close();
	}
	return records;
}

/**
 * The records of each relation source, in order, each source queried
 * once. When the stored sizes (`dataBytes`) show that everything fits
 * the response cap next to the page's `pageBytes`, the sources load in
 * parallel. Otherwise they are read one by one within the remaining
 * budget, so a page whose own children are small is still served and an
 * oversized one fails before its relations are loaded.
 */
export async function loadRelationSources(
	queries: readonly RelationQuery[],
	pageBytes: number,
	session: ClientSession | null,
): Promise<StoredRecord[][]> {
	const estimate = queries.reduce(
		(sum, query) => sum + query.weight * boundOf(query),
		pageBytes,
	);
	if (estimate <= MAX_RESPONSE_BYTES) {
		return Promise.all(
			queries.map((query) =>
				findRecords(query, session).lean<StoredRecord[]>(),
			),
		);
	}
	const budget = { left: MAX_RESPONSE_BYTES - pageBytes };
	if (budget.left < 0) throw responseTooLarge(pageBytes);
	const loaded: StoredRecord[][] = [];
	for (const query of queries) {
		loaded.push(await readWithin(query, session, budget));
	}
	return loaded;
}
