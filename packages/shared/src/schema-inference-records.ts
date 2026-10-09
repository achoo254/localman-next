/**
 * Seed records of an inferred resource: the sample objects rebuilt with
 * `id`, the `{parent}Id` link and the schema fields only, within the caps
 * the API enforces when the records are saved (`MAX_RECORDS_PER_RESOURCE`,
 * `MAX_RECORD_BYTES`, `MAX_RESOURCE_BYTES`, `DEFAULT_JSON_LIMITS`).
 */
import {
	type JsonObject,
	type JsonValue,
	checkJson,
	jsonSize,
} from "./json-value.js";
import { MAX_RECORD_BYTES, MAX_RESOURCE_BYTES } from "./plan-limits.js";
import {
	MAX_RECORDS_PER_RESOURCE,
	OBJECT_ID_FIELD,
	RECORD_ID_PATTERN,
} from "./resource-constants.js";
import type { InferenceContext } from "./schema-inference-context.js";

/** A sample object and the id of the parent record it was found in. */
export interface Sample {
	readonly record: JsonObject;
	readonly parentId: JsonValue | null;
}

/** A kept record with the sample it came from (for its child items). */
export interface KeptRecord {
	readonly id: string | number;
	readonly sample: Sample;
	readonly record: JsonObject;
}

/** Numeric ids past this do not move the next generated id. */
const MAX_COUNTED_ID = 1_000_000_000;

function validId(value: JsonValue | undefined): string | number | null {
	if (typeof value === "number") {
		return Number.isSafeInteger(value) && value >= 0 ? value : null;
	}
	return typeof value === "string" && RECORD_ID_PATTERN.test(value)
		? value
		: null;
}

/** One past the highest numeric id of the samples. */
function firstFreeId(samples: readonly Sample[]): number {
	let next = 1;
	for (const { record } of samples) {
		const id = Number(validId(record[OBJECT_ID_FIELD]) ?? Number.NaN);
		if (Number.isSafeInteger(id) && id < MAX_COUNTED_ID && id >= next) {
			next = id + 1;
		}
	}
	return next;
}

/**
 * Rebuilds the samples as records. `columns` maps sample keys to field
 * names; samples whose id repeats, or whose record is over a size cap,
 * are dropped with a warning, and missing or invalid ids are numbered.
 */
export function buildRecords(
	ctx: InferenceContext,
	resource: string,
	samples: readonly Sample[],
	columns: ReadonlyMap<string, string>,
	parentKey: string | null,
): KeptRecord[] {
	const kept: KeptRecord[] = [];
	const seen = new Set<string>();
	let nextId = firstFreeId(samples);
	let bytes = 2;
	let renumbered = 0;
	let duplicates = 0;
	let oversized = 0;
	for (const sample of samples) {
		if (kept.length >= MAX_RECORDS_PER_RESOURCE) {
			ctx.warn(
				resource,
				"TOO_MANY_RECORDS",
				`Only the first ${MAX_RECORDS_PER_RESOURCE} records were kept`,
				{ max: MAX_RECORDS_PER_RESOURCE },
			);
			break;
		}
		const raw = sample.record[OBJECT_ID_FIELD];
		let id = validId(raw);
		if (id === null) {
			if (raw !== undefined && raw !== null) renumbered += 1;
			id = String(nextId);
			nextId += 1;
		}
		if (seen.has(String(id))) {
			duplicates += 1;
			continue;
		}
		const entries: [string, JsonValue][] = [[OBJECT_ID_FIELD, id]];
		if (parentKey !== null && sample.parentId !== null) {
			entries.push([parentKey, sample.parentId]);
		}
		for (const [key, field] of columns) {
			if (Object.hasOwn(sample.record, key)) {
				entries.push([field, sample.record[key] ?? null]);
			}
		}
		const record: JsonObject = Object.fromEntries(entries);
		const size = jsonSize(record).bytes;
		if (size > MAX_RECORD_BYTES || !checkJson(record).ok) {
			oversized += 1;
			continue;
		}
		if (bytes + size > MAX_RESOURCE_BYTES) {
			ctx.warn(
				resource,
				"RESOURCE_TOO_LARGE",
				"Records past the 2 MB resource cap were not kept",
				{ max: MAX_RESOURCE_BYTES },
			);
			break;
		}
		bytes += size + 1;
		seen.add(String(id));
		kept.push({ id, sample, record });
	}
	if (renumbered > 0) {
		ctx.warn(
			resource,
			"IDS_RENUMBERED",
			`${renumbered} records had an invalid id and were numbered`,
			{ count: renumbered },
		);
	}
	if (duplicates > 0) {
		ctx.warn(
			resource,
			"DUPLICATE_IDS",
			`${duplicates} records repeat an id and were skipped`,
			{ count: duplicates },
		);
	}
	if (oversized > 0) {
		ctx.warn(
			resource,
			"RECORDS_TOO_LARGE",
			`${oversized} records are too large or too deeply nested and were skipped`,
			{ count: oversized },
		);
	}
	return kept;
}
