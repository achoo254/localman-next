import {
	type JsonObject,
	type JsonValue,
	OBJECT_ID_FIELD,
	type ResourceField,
	jsonSize,
	parentKeyOf,
	relationSourceOf,
} from "@localman/shared";
import type { ClientSession } from "mongoose";
import { type StoredRecord, toRecordView } from "../resources/record-model.js";
import { parentKeyIn } from "../resources/resource-store.js";
import type { MockTarget } from "./mock-records.js";
import { type RelationQuery, loadRelationSources } from "./relation-budget.js";

type Resolver = (view: JsonObject) => JsonValue;

/** How one source fills its fields: what to read, then how to resolve. */
interface SourcePlan {
	/** `null` when the source is gone (its fields resolve to empty). */
	readonly query: RelationQuery | null;
	readonly build: (records: readonly StoredRecord[]) => Resolver;
}

function stringIds(views: readonly JsonObject[], key: string): string[] {
	return views.flatMap((view) => {
		const id = Object.hasOwn(view, key) ? view[key] : null;
		return typeof id === "string" ? [id] : [];
	});
}

/**
 * `Parent Resource`: the parent record (as stored, one level only, so
 * relation fields never recurse). `null` when it is missing.
 */
function parentPlan(
	target: MockTarget,
	views: readonly JsonObject[],
	weight: number,
): SourcePlan {
	const { resources, resource, parentKey } = target;
	const parentId = resource.parentId;
	const parent = parentId
		? resources.find((candidate) => candidate._id.equals(parentId))
		: undefined;
	if (!parent || parentKey === null) {
		return { query: null, build: () => () => null };
	}
	const ids = [...new Set(stringIds(views, parentKey))];
	const grandKey = parentKeyIn(resources, parent);
	return {
		query: {
			resource: parent,
			filter: { resourceId: parent._id, id: { $in: ids } },
			maxRecords: ids.length,
			weight,
		},
		build: (records) => {
			const byId = new Map(
				records.map((record) => [record.id, toRecordView(record, grandKey)]),
			);
			return (view) => {
				const [id] = stringIds([view], parentKey);
				return id === undefined ? null : (byId.get(id) ?? null);
			};
		},
	};
}

/** `Child Resource`: the records of a direct child under this record. */
function childPlan(
	target: MockTarget,
	childId: string | undefined,
	views: readonly JsonObject[],
	weight: number,
): SourcePlan {
	const { resources, resource } = target;
	const child = resources.find(
		(candidate) =>
			candidate._id.toHexString() === childId &&
			candidate.parentId?.equals(resource._id) === true,
	);
	if (!child) return { query: null, build: () => () => [] };
	const ids = stringIds(views, OBJECT_ID_FIELD);
	const childKey = parentKeyOf(resource.name);
	return {
		query: {
			resource: child,
			filter: { resourceId: child._id, parentRecordId: { $in: ids } },
			maxRecords: Number.POSITIVE_INFINITY,
			weight,
		},
		build: (records) => {
			const byParent = new Map<string, JsonObject[]>();
			for (const record of records) {
				const key = record.parentRecordId ?? "";
				const list = byParent.get(key) ?? [];
				list.push(toRecordView(record, childKey));
				byParent.set(key, list);
			}
			return (view) => {
				const [id] = stringIds([view], OBJECT_ID_FIELD);
				return id === undefined ? [] : (byParent.get(id) ?? []);
			};
		},
	};
}

/** Relation fields grouped by the source they read (`relationSourceOf`). */
function fieldsBySource(schema: readonly ResourceField[]) {
	const groups = new Map<string, ResourceField[]>();
	for (const field of schema) {
		const source = relationSourceOf(field);
		if (source === null) continue;
		groups.set(source, [...(groups.get(source) ?? []), field]);
	}
	return [...groups.values()];
}

/**
 * Adds the `Parent Resource` and `Child Resource` fields to record views:
 * they are not stored (ADR-0001) but resolved here. Each source is read
 * once for the whole page, however many fields repeat it (older schemas
 * may), and within the response byte budget (`loadRelationSources`).
 * Views without relation fields come back unchanged.
 */
export async function withRelations(
	target: MockTarget,
	views: readonly JsonObject[],
	session: ClientSession | null = null,
): Promise<JsonObject[]> {
	const groups = fieldsBySource(target.resource.schema);
	if (groups.length === 0 || views.length === 0) return [...views];
	const plans = groups.map(([first, ...rest]) => {
		const weight = rest.length + 1;
		return first?.type === "Parent Resource"
			? parentPlan(target, views, weight)
			: childPlan(target, first?.childId, views, weight);
	});
	const queries = plans.flatMap((plan) => (plan.query ? [plan.query] : []));
	const loaded = await loadRelationSources(
		queries,
		views.reduce((sum, view) => sum + jsonSize(view).bytes, 0),
		session,
	);
	const recordsOf = new Map(
		queries.map((query, index) => [query, loaded[index] ?? []]),
	);
	const resolvers = plans.flatMap((plan, index) => {
		const resolve = plan.build(
			plan.query ? (recordsOf.get(plan.query) ?? []) : [],
		);
		return (groups[index] ?? []).map((field): [string, Resolver] => [
			field.name,
			resolve,
		]);
	});
	const names = new Set(resolvers.map(([name]) => name));
	return views.map((view) =>
		Object.fromEntries([
			...Object.entries(view).filter(([key]) => !names.has(key)),
			...resolvers.map(([name, resolve]): [string, JsonValue] => [
				name,
				resolve(view),
			]),
		]),
	);
}
