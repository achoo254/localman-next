import { OperationError } from "@localman/operations";
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
import { RecordModel } from "./record-model.js";
import { ResourceModel, type StoredResource } from "./resource-model.js";
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
	return withResourceSlots(
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
			assertDefinitionFits(
				{ schema, template: input.template ?? null },
				{
					parentKey: parent ? parentKeyOf(parent.name) : null,
					childIds: new Set(),
				},
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
}

/**
 * A rename changes the Parent ID name of the children's records. Records
 * that already hold a data field of that name would have it hidden behind
 * the generated value, so the rename is refused (409) instead. The key is
 * built from a resource name (`[\w-]` plus `Id`), never from data.
 */
async function assertChildDataFree(
	resources: readonly StoredResource[],
	parent: StoredResource,
	newName: string,
	session: ClientSession,
): Promise<void> {
	const childIds = resources
		.filter((r) => r.parentId?.equals(parent._id))
		.map((r) => r._id);
	if (childIds.length === 0) return;
	const key = parentKeyOf(newName);
	const clash = await RecordModel.exists({
		resourceId: { $in: childIds },
		[`data.${key}`]: { $exists: true },
	}).session(session);
	if (clash) {
		throw new OperationError(
			409,
			"FIELD_CONFLICT",
			`Records of a child resource already have a field "${key}"; rename or remove it first`,
		);
	}
}

/**
 * Renames a resource and replaces its schema, template or endpoints
 * (absent ones are kept). A rename changes the Parent ID name of its
 * children, so their schemas must still fit. Data is kept.
 */
export async function updateResource(
	project: StoredProject,
	resourceId: string,
	input: ResourceUpdate,
): Promise<ResourceSnapshot> {
	assertTemplateFits(input.template);
	return inProjectTransaction(project._id, async (session) => {
		const resources = await loadResources(project._id, session);
		const target = findResource(resources, resourceId);
		const problem = attachProblem(toTreeNodes(resources), {
			id: resourceId,
			parentId: target.parentId?.toHexString() ?? null,
			name: input.name,
		});
		if (problem) throw treeError(problem);
		for (const child of resources.filter((r) =>
			r.parentId?.equals(target._id),
		)) {
			assertDefinitionFits(
				child,
				{
					parentKey: parentKeyOf(input.name),
					childIds: childIdsOf(resources, child),
				},
				false,
			);
		}
		if (input.name !== target.name) {
			await assertChildDataFree(resources, target, input.name, session);
		}
		const schema = input.schema ?? target.schema;
		const template =
			input.template !== undefined ? input.template : target.template;
		assertDefinitionFits(
			{ schema, template },
			{
				parentKey: parentKeyIn(resources, target),
				childIds: childIdsOf(resources, target),
			},
			input.schema !== undefined || input.template !== undefined,
		);
		await ResourceModel.updateOne(
			{ _id: target._id },
			{
				$set: {
					name: input.name,
					schema,
					...(input.template !== undefined ? { template: input.template } : {}),
					...(input.endpoints !== undefined
						? { endpoints: completeEndpoints(input.endpoints) }
						: {}),
				},
			},
			{ session },
		);
		return snapshotAfterWrite(project._id, target._id, session);
	});
}
