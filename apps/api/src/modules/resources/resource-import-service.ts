import { validationError } from "@localman/operations";
import {
	type ResourceField,
	completeEndpoints,
	limitsFor,
	parentKeyOf,
	resourceCreateSchema,
} from "@localman/shared";
import { Types } from "mongoose";
import { currentPlanOf } from "../billing/plan-guard.js";
import type { StoredProject } from "../projects/project-model.js";
import { type PreparedRecords, prepareRecords } from "./record-input.js";
import type { PlannedResource } from "./resource-import-plan.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
import { withResourceSlots } from "./resource-quota.js";
import { assertDefinitionFits, treeError } from "./resource-rules.js";
import {
	findResource,
	loadResources,
	toTreeNodes,
	writeRecords,
} from "./resource-store.js";
import { type TreeNode, attachProblem } from "./resource-tree.js";

/**
 * Resources the project owner may still create on their plan (over all
 * their projects), `null` when the plan has no cap: `Infinity` would turn
 * into `null` in JSON anyway, so it is mapped here on purpose.
 */
export async function resourcesLeftFor(
	project: StoredProject,
): Promise<number | null> {
	const max = limitsFor(await currentPlanOf(project.owner)).resources;
	if (!Number.isFinite(max)) return null;
	const used = await ResourceModel.countDocuments({ ownerSub: project.owner });
	return Math.max(0, max - used);
}

export interface ImportedResources {
	/** In the order of the plan: parents before children. */
	readonly created: readonly StoredResource[];
	readonly resources: readonly StoredResource[];
}

/** Where a planned resource goes and the ids it links to. */
interface Placement {
	readonly id: string;
	readonly parentId: string | null;
	/** `{parent}Id` of its records, `null` at the root. */
	readonly parentKey: string | null;
	readonly idOf: (key: string) => string;
	/** Record ids of the parent when it is created by this import too. */
	readonly parentRecordIds: readonly string[] | null;
}

/** The checked schema and seed records of one planned resource. */
function prepare(
	planned: PlannedResource,
	place: Placement,
): { schema: ResourceField[]; seed: PreparedRecords } {
	const input = resourceCreateSchema.safeParse({
		name: planned.name,
		parentId: place.parentId,
		schema: [
			...planned.fields,
			...planned.childFields.map((field) => ({
				name: field.name,
				type: "Child Resource",
				childId: place.idOf(field.child),
			})),
		],
	});
	if (!input.success) throw validationError(input.error);
	const schema = input.data.schema ?? [];
	const childIds = new Set(planned.childFields.map((f) => place.idOf(f.child)));
	assertDefinitionFits(
		{ schema, template: null },
		{ parentKey: place.parentKey, childIds },
		true,
	);
	const seed = prepareRecords(planned.records, {
		parentKey: place.parentKey,
		parentRecordIds: place.parentRecordIds,
		resource: { id: place.id, name: planned.name },
	});
	return { schema, seed };
}

/**
 * Creates the planned resources in one project transaction, billed to the
 * owner's resource quota (403 `PLAN_LIMIT_REACHED` past the plan): the
 * top-level ones under `parentId` (`null`: the root), the others under
 * their planned parent, each with its Child Resource fields and its seed
 * records (`prepareRecords`: ids, parent links, the 32 KB / 2 MB caps).
 * Sibling names and depth follow the tree rules (409).
 */
export async function createImportedResources(
	project: StoredProject,
	plan: readonly PlannedResource[],
	parentId: string | null = null,
): Promise<ImportedResources> {
	const ids = new Map(plan.map((r) => [r.key, new Types.ObjectId()]));
	const idOf = (key: string): string => ids.get(key)?.toHexString() ?? "";
	return withResourceSlots(
		project.owner,
		project._id,
		plan.length,
		async (slots, session) => {
			const existing = await loadResources(project._id, session);
			const nodes: TreeNode[] = toTreeNodes(existing);
			const recordIds = new Map<string, string[]>();
			const seeds: PreparedRecords[] = [];
			const docs = plan.map((planned, index) => {
				const id = idOf(planned.key);
				const parent =
					planned.parent === null ? parentId : idOf(planned.parent);
				const problem = attachProblem(nodes, {
					parentId: parent,
					name: planned.name,
				});
				if (problem) throw treeError(problem);
				nodes.push({ id, parentId: parent, name: planned.name });
				const parentName =
					planned.parentName ??
					existing.find((r) => r._id.toHexString() === parent)?.name ??
					null;
				const parentKey = parentName === null ? null : parentKeyOf(parentName);
				const { schema, seed } = prepare(planned, {
					id,
					parentId: parent,
					parentKey,
					idOf,
					parentRecordIds:
						planned.parent === null
							? null
							: (recordIds.get(planned.parent) ?? []),
				});
				recordIds.set(
					planned.key,
					seed.records.map((record) => record.id),
				);
				seeds.push(seed);
				return {
					_id: new Types.ObjectId(id),
					projectId: project._id,
					parentId: parent === null ? null : new Types.ObjectId(parent),
					name: planned.name,
					parentKey,
					schema,
					template: null,
					endpoints: completeEndpoints(undefined),
					dataBytes: 0,
					ownerSub: project.owner,
					quotaSlot: slots[index],
				};
			});
			await ResourceModel.insertMany(docs, { session });
			const inserted = await loadResources(project._id, session);
			for (const [index, planned] of plan.entries()) {
				const seed = seeds[index];
				if (seed === undefined || seed.records.length === 0) continue;
				const resource = findResource(inserted, idOf(planned.key));
				await writeRecords(resource, seed.records, seed.nextId, session);
			}
			const resources = await loadResources(project._id, session);
			const created = plan.map((r) => findResource(resources, idOf(r.key)));
			return { created, resources };
		},
	);
}
