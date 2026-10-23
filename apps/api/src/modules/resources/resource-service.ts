import {
	DEFAULT_RESOURCE_FIELDS,
	type ResourceCreate,
	type ResourceUpdate,
	completeEndpoints,
	parentKeyOf,
} from "@localman/shared";
import { type ClientSession, Types } from "mongoose";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { emitResourceChanged } from "./resource-events.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
import {
	assertRecordsFree,
	chooseParentKey,
	renameChildKeys,
} from "./resource-parent-key.js";
import { withResourceSlots } from "./resource-quota.js";
import {
	assertDefinitionFits,
	assertTemplateFits,
	childIdsOf,
	treeError,
} from "./resource-rules.js";
import {
	findResource,
	loadResources,
	parentKeyIn,
	toTreeNodes,
} from "./resource-store.js";
import { attachProblem } from "./resource-tree.js";

/** A resource as stored after a write, with the project's resources. */
export interface ResourceSnapshot {
	readonly resource: StoredResource;
	readonly resources: readonly StoredResource[];
}

export async function snapshotAfterWrite(
	projectId: Types.ObjectId,
	resourceId: Types.ObjectId,
	session: ClientSession,
): Promise<ResourceSnapshot> {
	const resources = await loadResources(projectId, session);
	return {
		resource: findResource(resources, resourceId.toHexString()),
		resources,
	};
}

/**
 * Creates a resource billed to the project owner's resource quota, with
 * the default schema and endpoints unless the caller sent them.
 */
export async function createResource(
	project: StoredProject,
	input: ResourceCreate,
): Promise<ResourceSnapshot> {
	assertTemplateFits(input.template);
	const snapshot = await withResourceSlots(
		project.owner,
		project._id,
		1,
		async ([slot], session) => {
			const resources = await loadResources(project._id, session);
			const problem = attachProblem(toTreeNodes(resources), input);
			if (problem) throw treeError(problem);
			const parent =
				input.parentId === null
					? null
					: findResource(resources, input.parentId);
			const schema = input.schema ?? [...DEFAULT_RESOURCE_FIELDS];
			const definition = { schema, template: input.template ?? null };
			const parentKey = chooseParentKey(
				input.parentKey,
				parent ? parentKeyOf(parent.name) : null,
				definition,
			);
			assertDefinitionFits(
				definition,
				{ parentKey, childIds: new Set() },
				true,
			);
			const id = new Types.ObjectId();
			await ResourceModel.create(
				[
					{
						_id: id,
						projectId: project._id,
						parentId: parent?._id ?? null,
						name: input.name,
						parentKey,
						schema,
						template: input.template ?? null,
						endpoints: completeEndpoints(input.endpoints),
						dataBytes: 0,
						ownerSub: project.owner,
						quotaSlot: slot,
					},
				],
				{ session },
			);
			return snapshotAfterWrite(project._id, id, session);
		},
	);
	emitResourceChanged(project._id);
	return snapshot;
}

/**
 * Renames a resource and replaces its schema, template, endpoints or
 * Parent ID (absent ones are kept). A rename changes the Parent ID of
 * children whose key follows the name (`renameChildKeys`), so their
 * schemas and records must still fit. Data is kept: records store the
 * parent record id, not the key, so a new key needs no record rewrite.
 */
export async function updateResource(
	project: StoredProject,
	resourceId: string,
	input: ResourceUpdate,
): Promise<ResourceSnapshot> {
	assertTemplateFits(input.template);
	const snapshot = await inProjectTransaction(project._id, async (session) => {
		const resources = await loadResources(project._id, session);
		const target = findResource(resources, resourceId);
		const problem = attachProblem(toTreeNodes(resources), {
			id: resourceId,
			parentId: target.parentId?.toHexString() ?? null,
			name: input.name,
		});
		if (problem) throw treeError(problem);
		const childKeys = await renameChildKeys(
			resources,
			target,
			input.name,
			session,
		);
		const schema = input.schema ?? target.schema;
		const template =
			input.template !== undefined ? input.template : target.template;
		const currentKey = parentKeyIn(resources, target);
		const parentKey = chooseParentKey(input.parentKey, currentKey, {
			schema,
			template,
		});
		assertDefinitionFits(
			{ schema, template },
			{ parentKey, childIds: childIdsOf(resources, target) },
			input.schema !== undefined || input.template !== undefined,
		);
		const keyChanged = parentKey !== currentKey;
		if (keyChanged && parentKey !== null) {
			await assertRecordsFree([target._id], parentKey, session);
		}
		if (childKeys.length > 0) {
			await ResourceModel.bulkWrite(childKeys, { session });
		}
		await ResourceModel.updateOne(
			{ _id: target._id },
			{
				$set: {
					name: input.name,
					schema,
					...(keyChanged ? { parentKey } : {}),
					...(input.template !== undefined ? { template: input.template } : {}),
					...(input.endpoints !== undefined
						? { endpoints: completeEndpoints(input.endpoints) }
						: {}),
				},
				$inc: { revision: 1 },
			},
			{ session },
		);
		return snapshotAfterWrite(project._id, target._id, session);
	});
	emitResourceChanged(project._id);
	return snapshot;
}
