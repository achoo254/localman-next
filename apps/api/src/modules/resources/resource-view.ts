import {
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	FIELD_TYPES,
} from "@localman/shared";
import { z } from "zod";
import type { StoredResource } from "./resource-model.js";
import { parentKeyIn, toTreeNodes } from "./resource-store.js";
import { orderTree } from "./resource-tree.js";

export const resourceView = z.object({
	id: z.string(),
	projectId: z.string(),
	parentId: z.string().nullable(),
	name: z.string(),
	/** Name of the generated Parent ID field (`userId`), `null` for a root. */
	parentKey: z.string().nullable(),
	schema: z.array(
		z.object({
			name: z.string(),
			type: z.enum(FIELD_TYPES),
			fakerMethod: z.string().optional(),
			childId: z.string().optional(),
		}),
	),
	template: z.record(z.string(), z.unknown()).nullable(),
	endpoints: z.array(
		z.object({
			method: z.enum(ENDPOINT_METHODS),
			path: z.enum(ENDPOINT_PATHS),
			enabled: z.boolean(),
			response: z.unknown(),
		}),
	),
	/** Number of records. */
	count: z.number().int().min(0),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type ResourceView = z.input<typeof resourceView>;

/** A tree entry: parents come before their children. */
export const resourceTreeItem = resourceView.extend({
	/** 0 for a root resource. */
	depth: z.number().int().min(0),
});

export const dataChange = z.object({
	resourceId: z.string(),
	name: z.string(),
	countBefore: z.number().int().min(0),
	countAfter: z.number().int().min(0),
});
export type DataChange = z.input<typeof dataChange>;

export function toResourceView(
	resource: StoredResource,
	resources: readonly StoredResource[],
): ResourceView {
	return {
		id: resource._id.toHexString(),
		projectId: resource.projectId.toHexString(),
		parentId: resource.parentId?.toHexString() ?? null,
		name: resource.name,
		parentKey: parentKeyIn(resources, resource),
		schema: resource.schema.map((field) => ({
			name: field.name,
			type: field.type,
			...(field.fakerMethod ? { fakerMethod: field.fakerMethod } : {}),
			...(field.childId ? { childId: field.childId } : {}),
		})),
		template: resource.template,
		endpoints: resource.endpoints.map((endpoint) => ({
			method: endpoint.method,
			path: endpoint.path,
			enabled: endpoint.enabled,
			response: endpoint.response,
		})),
		count: resource.count,
		createdAt: resource.createdAt.toISOString(),
		updatedAt: resource.updatedAt.toISOString(),
	};
}

/** The project's resources in tree order (pre-order, oldest sibling first). */
export function toResourceTree(
	resources: readonly StoredResource[],
): z.input<typeof resourceTreeItem>[] {
	const byId = new Map(resources.map((r) => [r._id.toHexString(), r]));
	return orderTree(toTreeNodes(resources)).flatMap(({ node, depth }) => {
		const resource = byId.get(node.id);
		return resource ? [{ ...toResourceView(resource, resources), depth }] : [];
	});
}

/** A data change of `resource` from its current count to `countAfter`. */
export function changeOf(
	resource: StoredResource,
	countAfter: number,
): DataChange {
	return {
		resourceId: resource._id.toHexString(),
		name: resource.name,
		countBefore: resource.count,
		countAfter,
	};
}
