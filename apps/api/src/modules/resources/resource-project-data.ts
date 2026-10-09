import { DEFAULT_GENERATE_COUNT } from "@localman/shared";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { generateRecords } from "./data-generator.js";
import { assertResourceSize, resourceRef } from "./data-size.js";
import { RecordModel } from "./record-model.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
import { loadResources, parentKeyIn, toTreeNodes } from "./resource-store.js";
import { orderTree } from "./resource-tree.js";
import { type DataChange, changeOf } from "./resource-view.js";

interface PlannedResource {
	readonly resource: StoredResource;
	readonly count: number;
	readonly parentRecordIds: readonly string[] | null;
}

/**
 * Counts of "Generate all", parents first: `count` for every resource
 * when given, else each keeps its count and an empty one gets
 * `DEFAULT_GENERATE_COUNT` (as in the prototype). A resource under a
 * parent that ends up empty stays empty instead of failing the whole run.
 */
function planGenerateAll(
	resources: readonly StoredResource[],
	count: number | undefined,
): PlannedResource[] {
	const byId = new Map(resources.map((r) => [r._id.toHexString(), r]));
	const idsByResource = new Map<string, string[]>();
	const planned: PlannedResource[] = [];
	for (const { node } of orderTree(toTreeNodes(resources))) {
		const resource = byId.get(node.id);
		if (!resource) continue;
		const parentRecordIds =
			node.parentId === null ? null : (idsByResource.get(node.parentId) ?? []);
		const wanted =
			count ?? (resource.count > 0 ? resource.count : DEFAULT_GENERATE_COUNT);
		const n = parentRecordIds?.length === 0 ? 0 : wanted;
		idsByResource.set(
			node.id,
			Array.from({ length: n }, (_, i) => String(i + 1)),
		);
		planned.push({ resource, count: n, parentRecordIds });
	}
	return planned;
}

/**
 * Regenerates every resource of the project in one transaction (all or
 * nothing, as before): one delete for the project, then each resource is
 * generated and inserted on its own, parents first, so at most one
 * resource's records are in memory at a time.
 */
export async function generateAllData(
	project: StoredProject,
	count: number | undefined,
	dryRun: boolean,
): Promise<DataChange[]> {
	const changesOf = (planned: readonly PlannedResource[]) =>
		planned.map((p) => changeOf(p.resource, p.count));
	if (dryRun) {
		return changesOf(planGenerateAll(await loadResources(project._id), count));
	}
	return inProjectTransaction(project._id, async (session) => {
		const resources = await loadResources(project._id, session);
		const planned = planGenerateAll(resources, count);
		await RecordModel.deleteMany({ projectId: project._id }, { session });
		const bytesById = new Map<string, number>();
		for (const { resource, count: n, parentRecordIds } of planned) {
			const records = generateRecords(
				{
					schema: resource.schema,
					template: resource.template,
					parentKey: parentKeyIn(resources, resource),
					resource: resourceRef(resource),
				},
				n,
				parentRecordIds,
			);
			if (records.length === 0) continue;
			bytesById.set(
				resource._id.toHexString(),
				assertResourceSize(records, resourceRef(resource)),
			);
			await RecordModel.insertMany(
				records.map((record) => ({
					...record,
					resourceId: resource._id,
					projectId: project._id,
				})),
				{ session, lean: true },
			);
		}
		await ResourceModel.bulkWrite(
			planned.map(({ resource, count: n }) => ({
				updateOne: {
					filter: { _id: resource._id },
					update: {
						$set: {
							count: n,
							nextId: n + 1,
							dataBytes: bytesById.get(resource._id.toHexString()) ?? 0,
						},
					},
				},
			})),
			{ session },
		);
		return changesOf(planned);
	});
}

/** Empties every resource of the project; schemas are kept. */
export async function resetAllData(
	project: StoredProject,
	dryRun: boolean,
): Promise<DataChange[]> {
	const changesOf = (resources: readonly StoredResource[]) =>
		resources.filter((r) => r.count > 0).map((r) => changeOf(r, 0));
	if (dryRun) return changesOf(await loadResources(project._id));
	return inProjectTransaction(project._id, async (session) => {
		const changes = changesOf(await loadResources(project._id, session));
		await RecordModel.deleteMany({ projectId: project._id }, { session });
		await ResourceModel.updateMany(
			{ projectId: project._id },
			{ $set: { count: 0, nextId: 1, dataBytes: 0 } },
			{ session },
		);
		return changes;
	});
}
