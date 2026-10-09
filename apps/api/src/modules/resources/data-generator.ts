import { type Faker, faker as defaultFaker } from "@faker-js/faker";
import { OperationError } from "@localman/operations";
import {
	type JsonObject,
	JsonTemplateError,
	type JsonValue,
	MAX_RECORD_BYTES,
	OBJECT_ID_FIELD,
	type ResourceField,
	TEMPLATE_LIMITS,
	isJsonObject,
	renderJsonTemplate,
} from "@localman/shared";
import { runFakerMethod } from "@localman/shared/faker-methods";
import { ByteMeter, type ResourceRef, dataTooLarge } from "./data-size.js";

/** What generation needs of a resource. */
export interface GenerationSpec {
	readonly schema: readonly ResourceField[];
	readonly template: JsonObject | null;
	/** `{parent}Id` of a nested resource, `null` for a root. */
	readonly parentKey: string | null;
	/** Named in size errors. */
	readonly resource: ResourceRef;
}

/** A record before it is stored (see `RecordModel`). */
export interface GeneratedRecord {
	readonly id: string;
	readonly parentRecordId: string | null;
	readonly data: JsonObject;
}

export function parentHasNoData(): OperationError {
	return new OperationError(
		409,
		"PARENT_HAS_NO_DATA",
		"Generate data for the parent resource first",
	);
}

/**
 * Value of one schema field for the record numbered `index` (1-based).
 * String and Number follow the source ("name 3", 3). Relation fields are
 * resolved by the mock runtime when it answers, so nothing is stored.
 */
function fieldValue(
	field: ResourceField,
	index: number,
	faker: Faker,
): JsonValue | undefined {
	switch (field.type) {
		case "Faker.js":
			return runFakerMethod(field.fakerMethod ?? "", faker) ?? null;
		case "String":
			return `${field.name} ${index}`;
		case "Number":
			return index;
		case "Boolean":
			return faker.datatype.boolean();
		case "Object":
			return {};
		case "Array":
			return [];
		case "Date":
			return faker.date.past().toISOString();
		case "Parent Resource":
		case "Child Resource":
			return undefined;
	}
}

/** Renders the object template, stopping at the record byte cap. */
function renderTemplate(
	template: JsonObject,
	resource: ResourceRef,
	faker: Faker,
): JsonValue {
	try {
		return renderJsonTemplate(template, {
			resolveMethod: (id) => runFakerMethod(id, faker),
			limits: TEMPLATE_LIMITS,
			maxBytes: MAX_RECORD_BYTES,
		});
	} catch (error) {
		if (!(error instanceof JsonTemplateError)) throw error;
		throw dataTooLarge("record", error.bytes ?? MAX_RECORD_BYTES + 1, resource);
	}
}

function recordData(
	spec: GenerationSpec,
	index: number,
	faker: Faker,
): JsonObject {
	const reserved = (key: string) =>
		key === OBJECT_ID_FIELD || key === spec.parentKey;
	if (spec.template) {
		const rendered = renderTemplate(spec.template, spec.resource, faker);
		const entries = isJsonObject(rendered) ? Object.entries(rendered) : [];
		return Object.fromEntries(entries.filter(([key]) => !reserved(key)));
	}
	const entries: [string, JsonValue][] = [];
	for (const field of spec.schema) {
		const value = fieldValue(field, index, faker);
		if (value !== undefined && !reserved(field.name)) {
			entries.push([field.name, value]);
		}
	}
	return Object.fromEntries(entries);
}

/**
 * `count` records with ids "1"…"count", from the template when there is
 * one, else from the schema. A nested resource spreads its records at
 * random over `parentRecordIds` (the user's choice: N records in total,
 * not N per parent) and needs at least one parent record. Throws 413
 * `DATA_TOO_LARGE` as soon as a record or the running total passes the
 * byte caps of `plan-limits`.
 */
export function generateRecords(
	spec: GenerationSpec,
	count: number,
	parentRecordIds: readonly string[] | null,
	faker: Faker = defaultFaker,
): GeneratedRecord[] {
	if (count > 0 && parentRecordIds !== null && parentRecordIds.length === 0) {
		throw parentHasNoData();
	}
	const meter = new ByteMeter(spec.resource);
	return Array.from({ length: count }, (_, offset) => {
		const index = offset + 1;
		const record = {
			id: String(index),
			parentRecordId:
				parentRecordIds === null
					? null
					: faker.helpers.arrayElement(parentRecordIds),
			data: recordData(spec, index, faker),
		};
		meter.add(record);
		return record;
	});
}
