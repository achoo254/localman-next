import {
	type JsonObject,
	type JsonValue,
	OBJECT_ID_FIELD,
	parentKeyOf,
} from "@localman/shared";
import type { ClientSession } from "mongoose";
import {
	RecordModel,
	type StoredRecord,
	toRecordView,
} from "../resources/record-model.js";
import { parentKeyIn } from "../resources/resource-store.js";
import type { MockTarget } from "./mock-records.js";

type Resolver = (view: JsonObject) => JsonValue;

/**
 * `Parent Resource`: the parent record (as stored, one level only, so
 * relation fields never recurse). `null` when it is missing.
 */
async function parentResolver(
	target: MockTarget,
	views: readonly JsonObject[],
	session: ClientSession | null,
): Promise<Resolver> {
	const { resources, resource, parentKey } = target;
	const parentId = resource.parentId;
	const parent = parentId
		? resources.find((candidate) => candidate._id.equals(parentId))
		: undefined;
	if (!parent || parentKey === null) return () => null;
	const ids = [
		...new Set(
			views.flatMap((view) => {
				const id = Object.hasOwn(view, parentKey) ? view[parentKey] : null;
				return typeof id === "string" ? [id] : [];
			}),
		),
	];
	const records = await RecordModel.find({
		resourceId: parent._id,
		id: { $in: ids },
	})
		.select("id parentRecordId data")
		.session(session)
		.lean<StoredRecord[]>();
	const grandKey = parentKeyIn(resources, parent);
	const byId = new Map(
		records.map((record) => [record.id, toRecordView(record, grandKey)]),
	);
	return (view) => {
		const id = Object.hasOwn(view, parentKey) ? view[parentKey] : null;
		return typeof id === "string" ? (byId.get(id) ?? null) : null;
	};
}

/** `Child Resource`: the records of a direct child under this record. */
async function childResolver(
	target: MockTarget,
	childId: string | undefined,
	views: readonly JsonObject[],
	session: ClientSession | null,
): Promise<Resolver> {
	const { resources, resource } = target;
	const child = resources.find(
		(candidate) =>
			candidate._id.toHexString() === childId &&
			candidate.parentId?.equals(resource._id) === true,
	);
	if (!child) return () => [];
	const ids = views.flatMap((view) => {
		const id = view[OBJECT_ID_FIELD];
		return typeof id === "string" ? [id] : [];
	});
	const records = await RecordModel.find({
		resourceId: child._id,
		parentRecordId: { $in: ids },
	})
		.select("id parentRecordId data")
		.sort({ _id: 1 })
		.session(session)
		.lean<StoredRecord[]>();
	const childKey = parentKeyOf(resource.name);
	const byParent = new Map<string, JsonObject[]>();
	for (const record of records) {
		const key = record.parentRecordId ?? "";
		const list = byParent.get(key) ?? [];
		list.push(toRecordView(record, childKey));
		byParent.set(key, list);
	}
	return (view) => {
		const id = view[OBJECT_ID_FIELD];
		return typeof id === "string" ? (byParent.get(id) ?? []) : [];
	};
}

/**
 * Adds the `Parent Resource` and `Child Resource` fields to record views:
 * they are not stored (ADR-0001) but resolved here, one query per field
 * for the whole page. Views without relation fields come back unchanged.
 */
export async function withRelations(
	target: MockTarget,
	views: readonly JsonObject[],
	session: ClientSession | null = null,
): Promise<JsonObject[]> {
	const fields = target.resource.schema.filter(
		(field) =>
			field.type === "Parent Resource" || field.type === "Child Resource",
	);
	if (fields.length === 0 || views.length === 0) return [...views];
	const resolvers = await Promise.all(
		fields.map(async (field) => ({
			name: field.name,
			resolve:
				field.type === "Parent Resource"
					? await parentResolver(target, views, session)
					: await childResolver(target, field.childId, views, session),
		})),
	);
	const names = new Set(fields.map((field) => field.name));
	return views.map((view) =>
		Object.fromEntries([
			...Object.entries(view).filter(([key]) => !names.has(key)),
			...resolvers.map(({ name, resolve }): [string, JsonValue] => [
				name,
				resolve(view),
			]),
		]),
	);
}
