import {
	type JsonObject,
	OBJECT_ID_FIELD,
	RELATION_FIELD_TYPES,
} from "@localman/shared";
import type { ClientSession, Types } from "mongoose";
import { recordBytes } from "../resources/data-size.js";
import {
	RecordModel,
	type StoredRecord,
	toRecordView,
} from "../resources/record-model.js";
import type { StoredResource } from "../resources/resource-model.js";
import type { QueryFields } from "./query-engine.js";

/** The resource a mock route addresses, with the records above it. */
export interface MockTarget {
	readonly projectId: Types.ObjectId;
	/** Every resource of the project (relation fields, cascades). */
	readonly resources: readonly StoredResource[];
	readonly resource: StoredResource;
	/** `{parent}Id` of its records, `null` for a root resource. */
	readonly parentKey: string | null;
	/** `/users/1/posts/2/…`: users#1 then posts#2, outermost first. */
	readonly ancestors: readonly {
		readonly resource: StoredResource;
		readonly recordId: string;
	}[];
}

/** Parent record named by a nested route, `null` on a flat route. */
export function routeParentId(target: MockTarget): string | null {
	return target.ancestors.at(-1)?.recordId ?? null;
}

/**
 * Mongo filter of the route's collection. Built only from fixed system
 * columns and string values, never from keys of user data.
 */
export function collectionFilter(target: MockTarget): {
	resourceId: Types.ObjectId;
	parentRecordId?: string;
} {
	const parentRecordId = routeParentId(target);
	return parentRecordId === null
		? { resourceId: target.resource._id }
		: { resourceId: target.resource._id, parentRecordId };
}

/**
 * Whether every record named on the path exists and hangs under the one
 * before it (`/users/1/posts/2/comments` needs users#1 and posts#2 of
 * user 1). A missing ancestor makes the route answer "Not found".
 */
export async function ancestorsExist(
	target: MockTarget,
	session: ClientSession | null = null,
): Promise<boolean> {
	const checks = target.ancestors.map(({ resource, recordId }, index) => {
		const parentRecordId =
			index > 0 ? target.ancestors[index - 1]?.recordId : undefined;
		return RecordModel.exists(
			parentRecordId === undefined
				? { resourceId: resource._id, id: recordId }
				: { resourceId: resource._id, id: recordId, parentRecordId },
		).session(session);
	});
	const found = await Promise.all(checks);
	return found.every((hit) => hit !== null);
}

/**
 * The route's records as users see them, in insertion order, and the
 * bytes read for them. A flat route reads the whole resource, whose size
 * is stored (`dataBytes`); a nested one reads one parent's records,
 * measured here.
 */
export async function readRecords(
	target: MockTarget,
): Promise<{ views: JsonObject[]; bytes: number }> {
	const records = await RecordModel.find(collectionFilter(target))
		.select("id parentRecordId data")
		.sort({ _id: 1 })
		.lean<StoredRecord[]>();
	const stored =
		target.ancestors.length === 0 ? target.resource.dataBytes : undefined;
	const bytes =
		stored ?? records.reduce((sum, record) => sum + recordBytes(record), 0);
	const views = records.map((record) => toRecordView(record, target.parentKey));
	return { views, bytes };
}

/** One record of the route's collection, or `null`. */
export async function findRecord(
	target: MockTarget,
	id: string,
	session: ClientSession | null = null,
): Promise<StoredRecord | null> {
	return RecordModel.findOne({ ...collectionFilter(target), id })
		.select("id parentRecordId data")
		.session(session)
		.lean<StoredRecord>();
}

export function viewOf(target: MockTarget, record: StoredRecord): JsonObject {
	return toRecordView(record, target.parentKey);
}

/** Schema fields (or object template keys) besides relation fields. */
export function dataFieldsOf(resource: StoredResource): string[] {
	if (resource.template) return Object.keys(resource.template);
	return resource.schema
		.filter((field) => !RELATION_FIELD_TYPES.has(field.type))
		.map((field) => field.name);
}

/** Names of relation fields, resolved per response and never stored. */
export function relationFieldsOf(resource: StoredResource): Set<string> {
	return new Set(
		resource.schema
			.filter((field) => RELATION_FIELD_TYPES.has(field.type))
			.map((field) => field.name),
	);
}

export function queryFieldsOf(target: MockTarget): QueryFields {
	const exact = new Set([OBJECT_ID_FIELD]);
	if (target.parentKey !== null) exact.add(target.parentKey);
	return { fields: new Set(dataFieldsOf(target.resource)), exact };
}
