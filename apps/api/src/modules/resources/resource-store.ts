import { faker } from "@faker-js/faker";
import { OperationError } from "@localman/operations";
import { resourceParentKey } from "@localman/shared";
import type { AnyBulkWriteOperation, ClientSession, Types } from "mongoose";
import type { GeneratedRecord } from "./data-generator.js";
import { assertResourceSize, resourceRef } from "./data-size.js";
import { RecordModel } from "./record-model.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
import { type TreeNode, descendantIds } from "./resource-tree.js";

/** Every resource of a project, oldest first (sibling order in the tree). */
export async function loadResources(
	projectId: Types.ObjectId,
	session: ClientSession | null = null,
): Promise<StoredResource[]> {
	return ResourceModel.find({ projectId })
		.sort({ createdAt: 1, _id: 1 })
		.session(session)
		.lean<StoredResource[]>();
}

export function resourceNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Resource not found");
}

/** The resource `id` among the project's; 404 when it is not one of them. */
export function findResource(
	resources: readonly StoredResource[],
	id: string,
): StoredResource {
	const found = resources.find((resource) => resource._id.toHexString() === id);
	if (!found) throw resourceNotFound();
	return found;
}

export function toTreeNodes(resources: readonly StoredResource[]): TreeNode[] {
	return resources.map((resource) => ({
		id: resource._id.toHexString(),
		parentId: resource.parentId?.toHexString() ?? null,
		name: resource.name,
	}));
}

/**
 * `{parent}Id` of the resource's records (`resourceParentKey`: the stored
 * key, else the old rule on the parent's name), `null` for a root.
 */
export function parentKeyIn(
	resources: readonly StoredResource[],
	resource: Pick<StoredResource, "parentId" | "parentKey">,
): string | null {
	const { parentId } = resource;
	if (parentId === null) return null;
	const parent = resources.find((candidate) => candidate._id.equals(parentId));
	return parent ? resourceParentKey(resource, parent.name) : null;
}

/** The resource and its descendants, as stored resources. */
export function subtreeOf(
	resources: readonly StoredResource[],
	resource: StoredResource,
): StoredResource[] {
	const ids = new Set(
		descendantIds(toTreeNodes(resources), resource._id.toHexString()),
	);
	return [
		resource,
		...resources.filter((candidate) => ids.has(candidate._id.toHexString())),
	];
}

export async function recordIdsOf(
	resourceId: Types.ObjectId,
	session: ClientSession | null = null,
): Promise<string[]> {
	const records = await RecordModel.find({ resourceId })
		.select("id")
		.session(session)
		.lean<{ id: string }[]>();
	return records.map((record) => record.id);
}

/**
 * Replaces every record of the resource and stores its new counters.
 * Refuses (413) records over the byte caps, whatever produced them.
 */
export async function writeRecords(
	resource: StoredResource,
	records: readonly GeneratedRecord[],
	nextId: number,
	session: ClientSession,
): Promise<void> {
	const dataBytes = assertResourceSize(records, resourceRef(resource));
	await RecordModel.deleteMany({ resourceId: resource._id }, { session });
	if (records.length > 0) {
		await RecordModel.insertMany(
			records.map((record) => ({
				...record,
				resourceId: resource._id,
				projectId: resource.projectId,
			})),
			{ session, lean: true },
		);
	}
	await ResourceModel.updateOne(
		{ _id: resource._id },
		{ $set: { count: records.length, nextId, dataBytes } },
		{ session },
	);
}

/** Empties the resources: no records, `count` 0, ids restart at "1". */
export async function resetResources(
	ids: readonly Types.ObjectId[],
	session: ClientSession,
): Promise<void> {
	if (ids.length === 0) return;
	await RecordModel.deleteMany({ resourceId: { $in: ids } }, { session });
	await ResourceModel.updateMany(
		{ _id: { $in: ids } },
		{ $set: { count: 0, nextId: 1, dataBytes: 0 } },
		{ session },
	);
}

/**
 * Keeps every child record pointing at an existing parent record after the
 * parent's data was replaced. Ids restart at "1" like the source, so links
 * to ids that still exist are kept; records whose parent record is gone
 * get a random new one (the user's split rule). A parent left with no
 * records empties its whole subtree, since children cannot exist without
 * parent data.
 */
export async function reconcileChildren(
	resources: readonly StoredResource[],
	parent: StoredResource,
	parentRecordIds: readonly string[],
	session: ClientSession,
): Promise<void> {
	const children = resources.filter((r) => r.parentId?.equals(parent._id));
	if (parentRecordIds.length === 0) {
		const below = children.flatMap((child) => subtreeOf(resources, child));
		await resetResources(
			below.map((r) => r._id),
			session,
		);
		return;
	}
	for (const child of children) {
		const orphans = await RecordModel.find({
			resourceId: child._id,
			parentRecordId: { $nin: parentRecordIds },
		})
			.select("_id")
			.session(session)
			.lean<{ _id: Types.ObjectId }[]>();
		if (orphans.length === 0) continue;
		const updates: AnyBulkWriteOperation[] = orphans.map((orphan) => ({
			updateOne: {
				filter: { _id: orphan._id },
				update: {
					$set: { parentRecordId: faker.helpers.arrayElement(parentRecordIds) },
				},
			},
		}));
		await RecordModel.bulkWrite(updates, { session });
	}
}
