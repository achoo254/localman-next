/**
 * Resources from sample objects (pasted JSON, or CSV rows already typed):
 * fields and types from the values, `id` as the record id, the parent's
 * `{parent}Id` skipped on a nested resource, and arrays of objects turned
 * into child resources while depth and the resource cap allow.
 */
import { type JsonValue, isJsonObject } from "./json-value.js";
import {
	MAX_RESOURCE_DEPTH,
	OBJECT_ID_FIELD,
	parentKeyOf,
} from "./resource-constants.js";
import { SchemaImportFailure, paramText } from "./schema-import-errors.js";
import { FieldCollector, normalizeFieldName } from "./schema-import-fields.js";
import {
	type InferenceContext,
	MAX_INFERRED_RESOURCES,
} from "./schema-inference-context.js";
import { type Sample, buildRecords } from "./schema-inference-records.js";
import {
	columnsOf,
	isObjectList,
	shapeOfValues,
} from "./schema-inference-values.js";

export interface SampleSet {
	/** Final name, from `InferenceContext.resourceName`. */
	readonly name: string;
	readonly parentName: string | null;
	readonly parentField?: string;
	readonly samples: readonly Sample[];
	/** Keys known before the samples (a CSV header), in order. */
	readonly keys?: readonly string[];
	/** 1 for a root resource. */
	readonly depth: number;
}

/** `userId`, `user_id`, `authorID`: a key of a record elsewhere. */
const FOREIGN_KEY = /^[A-Za-z][A-Za-z0-9]*(?:Id|_id|ID)$/;

const isParentKey = (field: string, parentKey: string): boolean =>
	field === parentKey || field.replace(/_id$/i, "Id") === parentKey;

/**
 * Adds the resource of `set` to `ctx`, then its child resources. Types
 * come from the first `typeLimit` samples; records from all of them.
 */
export function inferFromSamples(
	ctx: InferenceContext,
	set: SampleSet,
	typeLimit = Number.POSITIVE_INFINITY,
): void {
	const { name, samples } = set;
	const parentKey =
		set.parentName === null ? null : parentKeyOf(set.parentName);
	const fields = new FieldCollector();
	const columns = new Map<string, string>();
	const children: { readonly key: string; readonly name: string }[] = [];
	for (const [key, values] of columnsOf(samples, typeLimit, set.keys ?? [])) {
		if (key === OBJECT_ID_FIELD) continue;
		const normalized = normalizeFieldName(key);
		if (parentKey !== null && isParentKey(normalized, parentKey)) continue;
		if (isObjectList(values)) {
			if (set.depth < MAX_RESOURCE_DEPTH && ctx.reserve()) {
				children.push({ key, name: ctx.resourceName(key) });
				continue;
			}
			fields.warn(
				key,
				"KEPT_AS_ARRAY",
				"Too many or too deeply nested resources; kept as Array",
				{ path: paramText(key) },
			);
		}
		const { shape, note } = shapeOfValues(values);
		const field = fields.add(key, shape);
		if (field === null) continue;
		if (note !== null) {
			fields.warn(field, note.code, note.message, { ...note.params, field });
		}
		if (FOREIGN_KEY.test(field)) {
			fields.warn(
				field,
				"FOREIGN_KEY",
				"Looks like the key of another resource; nest this resource under it to link records",
				{ field },
			);
		}
		columns.set(key, field);
	}
	ctx.addWarnings(name, fields.warnings);
	const kept = buildRecords(ctx, name, samples, columns, parentKey);
	ctx.resources.push({
		name,
		parentName: set.parentName,
		...(set.parentField === undefined ? {} : { parentField: set.parentField }),
		fields: fields.fields,
		records: kept.map(({ record }) => record),
	});
	for (const child of children) {
		const childSamples: Sample[] = [];
		for (const { id, sample } of kept) {
			const items = sample.record[child.key];
			if (!Array.isArray(items)) continue;
			for (const item of items) {
				if (isJsonObject(item))
					childSamples.push({ record: item, parentId: id });
			}
		}
		inferFromSamples(
			ctx,
			{
				name: child.name,
				parentName: name,
				parentField: normalizeFieldName(child.key),
				samples: childSamples,
				depth: set.depth + 1,
			},
			typeLimit,
		);
	}
}

/**
 * Root resources of a parsed JSON sample: one per key of an object whose
 * every value is an array of objects (a `db.json` of collections), else
 * one resource holding the object, or the objects of the array.
 */
export function inferFromSample(
	ctx: InferenceContext,
	value: JsonValue,
	rootName: string,
): void {
	const entries = isJsonObject(value) ? Object.entries(value) : [];
	const isCollections =
		entries.length > 0 &&
		entries.every(
			([, item]) => Array.isArray(item) && item.every(isJsonObject),
		) &&
		entries.some(([, item]) => Array.isArray(item) && item.length > 0);
	const roots: [string, JsonValue][] = isCollections
		? entries
		: [[rootName, value]];
	for (const [raw, item] of roots) {
		const items = Array.isArray(item) ? item : [item];
		const records = items.filter(isJsonObject);
		if (records.length === 0 && !isCollections) {
			throw items.length === 0
				? new SchemaImportFailure("JSON_EMPTY", "The array is empty")
				: new SchemaImportFailure(
						"JSON_SHAPE",
						"Expected an object or an array of objects",
					);
		}
		const path = paramText(raw);
		if (records.length < items.length) {
			const count = items.length - records.length;
			ctx.warn(raw, "NOT_OBJECTS", `${count} items are not objects; skipped`, {
				path,
				count,
			});
		}
		if (records.length === 0) {
			ctx.warn(raw, "SKIPPED", "No records; not imported", { path });
		} else if (!ctx.reserve()) {
			ctx.warn(raw, "TOO_MANY_RESOURCES", "Too many resources; not imported", {
				max: MAX_INFERRED_RESOURCES,
			});
		} else {
			const samples = records.map((record) => ({ record, parentId: null }));
			const name = ctx.resourceName(raw);
			inferFromSamples(ctx, { name, parentName: null, samples, depth: 1 });
		}
	}
}
