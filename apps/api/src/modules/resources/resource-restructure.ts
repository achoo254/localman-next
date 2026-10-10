import { parentKeyOf } from "@localman/shared";
import { Types } from "mongoose";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { RecordModel } from "./record-model.js";
import { deleteResourceDependents } from "./resource-dependents.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
import {
	assertDefinitionFits,
	childIdsOf,
	treeError,
	withoutStaleRelations,
} from "./resource-rules.js";
import {
	type ResourceSnapshot,
	snapshotAfterWrite,
} from "./resource-service.js";
import {
	findResource,
	loadResources,
	resetResources,
	subtreeOf,
	toTreeNodes,
} from "./resource-store.js";
import { attachProblem } from "./resource-tree.js";
import { type DataChange, changeOf } from "./resource-view.js";

/**
 * Changes that reshape the tree and drop data: deleting a subtree and
 * moving a resource under another parent. Both accept `dryRun`, which
 * reads without the transaction and reports what would change.
 */

export interface DeletedResource {
	readonly resourceId: string;
	readonly name: string;
	readonly count: number;
}

/**
 * Deletes a resource with every descendant, their records and the data
 * other modules keep per resource (`registerResourceDependent`), and
 * drops Child Resource fields of its parent that pointed at it. `dryRun`
 * only lists what would go.
 */
export async function deleteResource(
	project: StoredProject,
	resourceId: string,
	dryRun: boolean,
): Promise<DeletedResource[]> {
	const plan = (resources: readonly StoredResource[]) =>
		subtreeOf(resources, findResource(resources, resourceId));
	const describe = (subtree: readonly StoredResource[]) =>
		subtree.map((r) => ({
			resourceId: r._id.toHexString(),
			name: r.name,
			count: r.count,
		}));
	if (dryRun) return describe(plan(await loadResources(project._id)));
	return inProjectTransaction(project._id, async (session) => {
		const subtree = plan(await loadResources(project._id, session));
		const ids = subtree.map((r) => r._id);
		await RecordModel.deleteMany({ resourceId: { $in: ids } }, { session });
		await ResourceModel.deleteMany({ _id: { $in: ids } }, { session });
		await deleteResourceDependents(project._id, ids, session);
		await ResourceModel.updateMany(
			{ projectId: project._id },
			{ $pull: { schema: { childId: resourceId } } },
			{ session },
		);
		return describe(subtree);
	});
}

export interface MoveResult extends ResourceSnapshot {
	readonly changes: DataChange[];
}

/**
 * Nests the resource under `parentId` (or makes it a root). Its records
 * and those of its descendants are reset, since they pointed at records
 * of the old parent; relation fields that no longer apply are dropped.
 * The resource gets the Parent ID `parentKeyOf` builds from the new
 * parent's name, whatever key it had.
 * Moving to the current parent changes nothing.
 */
export async function moveResource(
	project: StoredProject,
	resourceId: string,
	parentId: string | null,
	dryRun: boolean,
): Promise<MoveResult> {
	const plan = (resources: readonly StoredResource[]) => {
		const target = findResource(resources, resourceId);
		if ((target.parentId?.toHexString() ?? null) === parentId) {
			return {
				target,
				unchanged: true,
				schema: target.schema,
				parentKey: null,
				subtree: [],
			};
		}
		const problem = attachProblem(toTreeNodes(resources), {
			id: resourceId,
			parentId,
			name: target.name,
		});
		if (problem) throw treeError(problem);
		const parent = parentId === null ? null : findResource(resources, parentId);
		const place = {
			parentKey: parent ? parentKeyOf(parent.name) : null,
			childIds: childIdsOf(resources, target),
		};
		const schema = withoutStaleRelations(target.schema, place);
		assertDefinitionFits({ schema, template: target.template }, place, false);
		const subtree = subtreeOf(resources, target).filter((r) => r.count > 0);
		return {
			target,
			unchanged: false,
			schema,
			parentKey: place.parentKey,
			subtree,
		};
	};
	const changesOf = (subtree: readonly StoredResource[]) =>
		subtree.map((r) => changeOf(r, 0));
	if (dryRun) {
		const resources = await loadResources(project._id);
		const { target, subtree } = plan(resources);
		return { resource: target, resources, changes: changesOf(subtree) };
	}
	return inProjectTransaction(project._id, async (session) => {
		const before = await loadResources(project._id, session);
		const { target, unchanged, schema, parentKey, subtree } = plan(before);
		if (unchanged) return { resource: target, resources: before, changes: [] };
		await ResourceModel.updateOne(
			{ _id: target._id },
			{
				$set: {
					parentId: parentId === null ? null : new Types.ObjectId(parentId),
					parentKey,
					schema,
				},
			},
			{ session },
		);
		await ResourceModel.updateMany(
			{ projectId: project._id },
			{ $pull: { schema: { childId: resourceId } } },
			{ session },
		);
		await resetResources(
			subtreeOf(before, target).map((r) => r._id),
			session,
		);
		const after = await snapshotAfterWrite(project._id, target._id, session);
		return { ...after, changes: changesOf(subtree) };
	});
}
