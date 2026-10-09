import { type Faker, faker as defaultFaker } from "@faker-js/faker";
import { OperationError } from "@localman/operations";
import {
	type JsonObject,
	type JsonValue,
	OBJECT_ID_FIELD,
	checkJson,
	isJsonObject,
} from "@localman/shared";
import type { ClientSession } from "mongoose";
import { recordData } from "../resources/data-generator.js";
import { ByteMeter, resourceRef } from "../resources/data-size.js";
import { RecordModel } from "../resources/record-model.js";
import type { StoredResource } from "../resources/resource-model.js";
import {
	type MockTarget,
	dataFieldsOf,
	relationFieldsOf,
} from "./mock-records.js";

export interface RecordBody {
	/** Fields to store: no `id`, `{parent}Id` or relation fields. */
	readonly data: JsonObject;
	/** `{parent}Id` as sent (used by POST on the flat route of a child). */
	readonly parentRef: JsonValue | undefined;
}

/**
 * Validates a POST/PUT/PATCH body: a JSON object within the JSON limits
 * whose keys avoid `FORBIDDEN_KEYS` (`__proto__`, `constructor`,
 * `prototype`, at any depth), else 400 `VALIDATION_ERROR`. An absent body
 * is `{}`. The copy is rebuilt from own properties, so nothing in it can
 * reach a prototype. `id` and `{parent}Id` are system fields and relation
 * fields are resolved per response: all three are dropped from the data.
 */
export function readRecordBody(body: unknown, target: MockTarget): RecordBody {
	const checked = checkJson(body ?? {});
	if (!checked.ok) {
		const [first] = checked.problems;
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			first?.path
				? `Invalid body at "${first.path}": ${first.message}`
				: (first?.message ?? "Invalid body"),
			checked.problems.map(({ path, message }) => ({ path, message })),
		);
	}
	if (!isJsonObject(checked.value)) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			"Request body must be a JSON object",
		);
	}
	const { parentKey } = target;
	const relations = relationFieldsOf(target.resource);
	const value = checked.value;
	return {
		data: Object.fromEntries(
			Object.entries(value).filter(
				([key]) =>
					key !== OBJECT_ID_FIELD && key !== parentKey && !relations.has(key),
			),
		),
		parentRef:
			parentKey !== null && Object.hasOwn(value, parentKey)
				? value[parentKey]
				: undefined,
	};
}

/**
 * `data` plus generated values for the schema fields (or object template
 * keys) it lacks, in schema order; String and Number fields use the
 * record number like the generator. Nothing is generated when no field
 * is missing.
 */
export function withMissingFields(
	data: JsonObject,
	target: MockTarget,
	index: number,
	faker: Faker = defaultFaker,
): JsonObject {
	const { resource, parentKey } = target;
	const missing = dataFieldsOf(resource).some(
		(name) => !Object.hasOwn(data, name),
	);
	if (!missing) return data;
	const generated = recordData(
		{
			schema: resource.schema,
			template: resource.template,
			parentKey,
			resource: resourceRef(resource),
		},
		index,
		faker,
	);
	return Object.fromEntries([
		...Object.entries(generated).map(([key, value]): [string, JsonValue] => [
			key,
			Object.hasOwn(data, key) ? (data[key] ?? null) : value,
		]),
		...Object.entries(data).filter(([key]) => !Object.hasOwn(generated, key)),
	]);
}

/** Stored fields with `changes` applied: existing keys keep their order. */
export function mergeData(stored: JsonObject, changes: JsonObject): JsonObject {
	return Object.fromEntries([
		...Object.entries(stored).map(([key, value]): [string, JsonValue] => [
			key,
			Object.hasOwn(changes, key) ? (changes[key] ?? null) : value,
		]),
		...Object.entries(changes).filter(([key]) => !Object.hasOwn(stored, key)),
	]);
}
