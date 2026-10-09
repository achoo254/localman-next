import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { registerProjectDependent } from "../projects/project-dependents.js";
import {
	ResourceTreeLockModel,
	inProjectTransaction,
	lockProject,
} from "../projects/project-lock.js";
import { ProjectModel } from "../projects/project-model.js";
import { assertResourceSize, resourceRef } from "./data-size.js";
import { RecordModel, type StoredRecord } from "./record-model.js";
import { ResourceModel } from "./resource-model.js";
import { withResourceSlots } from "./resource-quota.js";
import { loadResources } from "./resource-store.js";

/**
 * Copies the whole resource tree of `from` (schemas, templates, endpoints
 * and records) into the new project `to`, billed to the resource quota of
 * `to`'s owner (the user cloning). Resources get new ids; parent links,
 * Child Resource fields and records follow the mapping, while record ids
 * and their `parentRecordId` stay as they were.
 *
 * One transaction that also holds the source's lock, so the source is read
 * as one snapshot (`count` and `nextId` match the copied records) and
 * cannot change meanwhile. Records are copied resource by resource, each
 * within the byte cap. Any failure leaves nothing behind, and the clone
 * itself is then removed by `cloneProject`.
 */
async function copyResources(
	from: Types.ObjectId,
	to: Types.ObjectId,
): Promise<void> {
	const target = await ProjectModel.findById(to)
		.select("owner")
		.lean<{ owner: string }>();
	if (!target) throw new Error("Clone target project is missing");
	const sourceCount = await ResourceModel.countDocuments({ projectId: from });
	if (sourceCount === 0) return;

	await withResourceSlots(
		target.owner,
		to,
		sourceCount,
		async (slots, session) => {
			await lockProject(from, session);
			const source = await loadResources(from, session);
			if (source.length !== sourceCount) {
				// The source gained or lost resources between the quota count and
				// the lock. Not retried automatically: the caller gets 409, the
				// partial clone is removed, and cloning again sees the new tree.
				throw new OperationError(
					409,
					"CONFLICT",
					"The project changed while it was being cloned; try again",
				);
			}
			const newIds = new Map(
				source.map((r) => [r._id.toHexString(), new Types.ObjectId()]),
			);
			const mapped = (id: Types.ObjectId) =>
				newIds.get(id.toHexString()) ?? null;
			await ResourceModel.insertMany(
				source.map((resource, index) => ({
					_id: mapped(resource._id),
					projectId: to,
					parentId:
						resource.parentId === null ? null : mapped(resource.parentId),
					name: resource.name,
					schema: resource.schema.map((field) =>
						field.childId === undefined
							? field
							: {
									...field,
									childId:
										newIds.get(field.childId)?.toHexString() ?? field.childId,
								},
					),
					template: resource.template,
					endpoints: resource.endpoints,
					count: resource.count,
					nextId: resource.nextId,
					dataBytes: 0,
					ownerSub: target.owner,
					quotaSlot: slots[index],
				})),
				{ session },
			);
			for (const resource of source) {
				const records = await RecordModel.find({ resourceId: resource._id })
					.sort({ _id: 1 })
					.session(session)
					.lean<StoredRecord[]>();
				if (records.length === 0) continue;
				const dataBytes = assertResourceSize(records, resourceRef(resource));
				await ResourceModel.updateOne(
					{ _id: mapped(resource._id) },
					{ $set: { dataBytes } },
					{ session },
				);
				await RecordModel.insertMany(
					records.map((record) => ({
						resourceId: mapped(resource._id),
						projectId: to,
						parentRecordId: record.parentRecordId,
						id: record.id,
						data: record.data,
					})),
					{ session, lean: true },
				);
			}
		},
	);
}

/**
 * Runs after the project document is gone (see `deleteProjectCascade`),
 * under the project lock, so a resource write racing the deletion either
 * committed before this (and is deleted here) or retries and gets 404.
 */
async function deleteResources(projectId: Types.ObjectId): Promise<void> {
	await inProjectTransaction(
		projectId,
		async (session) => {
			await RecordModel.deleteMany({ projectId }, { session });
			await ResourceModel.deleteMany({ projectId }, { session });
			await ResourceTreeLockModel.deleteOne({ _id: projectId }, { session });
		},
		{ allowDeletedProject: true },
	);
}

// Registered at module load; resource-operations imports this module, so
// any process serving the registry cascades and clones resources.
registerProjectDependent({
	kind: "resources",
	count: (projectId) => ResourceModel.countDocuments({ projectId }),
	deleteAll: deleteResources,
	copy: copyResources,
});

// Records are copied together with their resources (ids must be mapped),
// so this entry only counts them in delete previews and removes them.
registerProjectDependent({
	kind: "records",
	count: (projectId) => RecordModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await RecordModel.deleteMany({ projectId });
	},
});
