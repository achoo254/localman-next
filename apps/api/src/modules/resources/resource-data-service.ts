import type { JsonObject } from "@localman/shared";
import type { ClientSession } from "mongoose";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { generateRecords, parentHasNoData } from "./data-generator.js";
import { resourceRef } from "./data-size.js";
import { prepareRecords } from "./record-input.js";
import {
	RecordModel,
	type StoredRecord,
	toRecordView,
} from "./record-model.js";
import type { StoredResource } from "./resource-model.js";
import {
	findResource,
	loadResources,
	parentKeyIn,
	reconcileChildren,
	recordIdsOf,
	subtreeOf,
	writeRecords,
} from "./resource-store.js";
import { type DataChange, changeOf } from "./resource-view.js";

/**
 * Data changes of one resource: its own count, plus the descendants that
 * lose their data when it ends up empty (children need parent records).
 */
function changesFor(
	resources: readonly StoredResource[],
	target: StoredResource,
	countAfter: number,
): DataChange[] {
	const emptied =
		countAfter === 0
			? subtreeOf(resources, target)
					.slice(1)
					.filter((r) => r.count > 0)
			: [];
	return [changeOf(target, countAfter), ...emptied.map((r) => changeOf(r, 0))];
}

interface Loaded {
	readonly resources: StoredResource[];
	readonly target: StoredResource;
	readonly parentRecordIds: string[] | null;
}

async function load(
	project: StoredProject,
	resourceId: string,
	session: ClientSession | null,
): Promise<Loaded> {
	const resources = await loadResources(project._id, session);
	const target = findResource(resources, resourceId);
	const parentRecordIds =
		target.parentId === null
			? null
			: await recordIdsOf(target.parentId, session);
	return { resources, target, parentRecordIds };
}

/**
 * Replaces the resource's data with `count` generated records (0 resets
 * it), then keeps its children consistent (see `reconcileChildren`). A
 * nested resource needs parent records: 409 `PARENT_HAS_NO_DATA`.
 */
export async function generateResourceData(
	project: StoredProject,
	resourceId: string,
	count: number,
	dryRun: boolean,
): Promise<DataChange[]> {
	const check = ({ resources, target, parentRecordIds }: Loaded) => {
		if (count > 0 && parentRecordIds?.length === 0) throw parentHasNoData();
		return changesFor(resources, target, count);
	};
	if (dryRun) return check(await load(project, resourceId, null));
	return inProjectTransaction(project._id, async (session) => {
		const loaded = await load(project, resourceId, session);
		const changes = check(loaded);
		const { resources, target, parentRecordIds } = loaded;
		const records = generateRecords(
			{
				schema: target.schema,
				template: target.template,
				parentKey: parentKeyIn(resources, target),
				resource: resourceRef(target),
			},
			count,
			parentRecordIds,
		);
		await writeRecords(target, records, count + 1, session);
		await reconcileChildren(
			resources,
			target,
			records.map((record) => record.id),
			session,
		);
		return changes;
	});
}

/**
 * Replaces the resource's data with `items` (validated by
 * `prepareRecords`), then keeps its children consistent.
 */
export async function replaceResourceData(
	project: StoredProject,
	resourceId: string,
	items: readonly unknown[],
	dryRun: boolean,
): Promise<DataChange[]> {
	const prepare = ({ resources, target, parentRecordIds }: Loaded) =>
		prepareRecords(items, {
			parentKey: parentKeyIn(resources, target),
			resource: resourceRef(target),
			parentRecordIds,
		});
	if (dryRun) {
		const loaded = await load(project, resourceId, null);
		const { records } = prepare(loaded);
		return changesFor(loaded.resources, loaded.target, records.length);
	}
	return inProjectTransaction(project._id, async (session) => {
		const loaded = await load(project, resourceId, session);
		const { records, nextId } = prepare(loaded);
		const changes = changesFor(loaded.resources, loaded.target, records.length);
		await writeRecords(loaded.target, records, nextId, session);
		await reconcileChildren(
			loaded.resources,
			loaded.target,
			records.map((record) => record.id),
			session,
		);
		return changes;
	});
}

export interface ResourceData {
	readonly resource: StoredResource;
	readonly resources: readonly StoredResource[];
	readonly records: JsonObject[];
}

/** The resource's records as users see them, in insertion order. */
export async function readResourceData(
	project: StoredProject,
	resourceId: string,
): Promise<ResourceData> {
	const resources = await loadResources(project._id);
	const resource = findResource(resources, resourceId);
	const parentKey = parentKeyIn(resources, resource);
	const stored = await RecordModel.find({ resourceId: resource._id })
		.sort({ _id: 1 })
		.lean<StoredRecord[]>();
	return {
		resource,
		resources,
		records: stored.map((record) => toRecordView(record, parentKey)),
	};
}
