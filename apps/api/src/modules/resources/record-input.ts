import { type Faker, faker as defaultFaker } from "@faker-js/faker";
import { type ErrorIssue, OperationError } from "@localman/operations";
import {
	type JsonValue,
	OBJECT_ID_FIELD,
	RECORD_ID_MAX,
	RECORD_ID_PATTERN,
	checkJson,
	isJsonObject,
} from "@localman/shared";
import { type GeneratedRecord, parentHasNoData } from "./data-generator.js";
import { ByteMeter, type ResourceRef } from "./data-size.js";

const NUMERIC_ID = /^\d+$/;
/**
 * Numeric ids above this do not move `nextId`: a pasted `9007199254740991`
 * would otherwise push every later id out of the safe-integer range.
 */
const MAX_COUNTED_ID = 1_000_000_000;

export interface RecordInputPlace {
	/** `{parent}Id` of a nested resource, `null` for a root. */
	readonly parentKey: string | null;
	/** Ids of the parent's records, `null` for a root. */
	readonly parentRecordIds: readonly string[] | null;
	/** Named in size errors. */
	readonly resource: ResourceRef;
}

export interface PreparedRecords {
	readonly records: GeneratedRecord[];
	/** One past the highest numeric id, so the next POST does not collide. */
	readonly nextId: number;
}

/** A string id, or the reason the value is not one. */
function idOf(value: JsonValue): string | { readonly problem: string } {
	const id =
		typeof value === "number" && Number.isSafeInteger(value) && value >= 0
			? String(value)
			: value;
	if (typeof id === "string" && RECORD_ID_PATTERN.test(id)) return id;
	return {
		problem: `must be a non-negative integer or a string of up to ${RECORD_ID_MAX} letters, digits, _, -, . or ~ with at least one letter or digit`,
	};
}

/**
 * Turns the array a user pasted into records, or throws 400 listing every
 * problem: items must be JSON objects; `id` is optional (missing ones get
 * the next free numbers) but unique; on a nested resource `{parent}Id`
 * must name an existing parent record (an explicit `null` is refused, not
 * silently replaced), and a missing one gets a random parent record (409
 * when the parent has none). Records over the byte caps answer 413.
 */
export function prepareRecords(
	items: readonly unknown[],
	place: RecordInputPlace,
	faker: Faker = defaultFaker,
): PreparedRecords {
	const issues: ErrorIssue[] = [];
	const parents = new Set(place.parentRecordIds ?? []);
	const seen = new Set<string>();
	const drafts = items.map((item, index) => {
		const path = `data.${index}`;
		const checked = checkJson(item);
		if (!checked.ok) {
			for (const problem of checked.problems) {
				issues.push({
					path: problem.path ? `${path}.${problem.path}` : path,
					message: problem.message,
				});
			}
			return null;
		}
		if (!isJsonObject(checked.value)) {
			issues.push({ path, message: "must be a JSON object" });
			return null;
		}
		const { [OBJECT_ID_FIELD]: rawId, ...rest } = checked.value;
		let id: string | null = null;
		if (rawId !== undefined) {
			const parsed = idOf(rawId);
			if (typeof parsed !== "string") {
				issues.push({ path: `${path}.id`, message: parsed.problem });
			} else if (seen.has(parsed)) {
				issues.push({
					path: `${path}.id`,
					message: `duplicate id "${parsed}"`,
				});
			} else {
				seen.add(parsed);
				id = parsed;
			}
		}
		let parentRecordId: string | null = null;
		const data = Object.fromEntries(
			Object.entries(rest).filter(([key]) => key !== place.parentKey),
		);
		if (place.parentKey !== null) {
			const rawParent = rest[place.parentKey];
			if (rawParent !== undefined) {
				const parsed = idOf(rawParent);
				if (typeof parsed === "string" && parents.has(parsed)) {
					parentRecordId = parsed;
				} else {
					issues.push({
						path: `${path}.${place.parentKey}`,
						message: "must be the id of an existing parent record",
					});
				}
			}
		}
		return { id, parentRecordId, data };
	});
	if (issues.length > 0) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`Invalid record at "${issues[0]?.path}": ${issues[0]?.message}`,
			issues,
		);
	}
	const parentIds = [...parents];
	if (place.parentKey !== null && parentIds.length === 0 && items.length > 0) {
		throw parentHasNoData();
	}
	const numericIds = [...seen]
		.filter((id) => NUMERIC_ID.test(id))
		.map(Number)
		.filter((id) => id <= MAX_COUNTED_ID);
	let nextId = 1 + Math.max(0, ...numericIds);
	const records = drafts.flatMap((draft) =>
		draft === null
			? []
			: [
					{
						id: draft.id ?? String(nextId++),
						parentRecordId:
							place.parentKey === null
								? null
								: (draft.parentRecordId ??
									faker.helpers.arrayElement(parentIds)),
						data: draft.data,
					},
				],
	);
	const meter = new ByteMeter(place.resource);
	for (const record of records) meter.add(record);
	return { records, nextId };
}
