import {
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	FIELD_TYPES,
} from "@localman/shared";
import { RULE_OPS, RULE_SOURCES } from "@localman/shared/endpoint-behavior";
import { z } from "zod";
import type { StoredResource } from "./resource-model.js";
import { parentKeyIn, toTreeNodes } from "./resource-store.js";
import { orderTree } from "./resource-tree.js";

/** Stored chaos of an endpoint (validated on write by `endpointChaosSchema`). */
const chaosView = z.object({
	latencyMs: z.tuple([z.number(), z.number()]),
	errorRate: z.number(),
	errorStatus: z.number().int(),
	timeoutRate: z.number(),
	rateLimitRate: z.number(),
});

/** Stored conditional rule (validated on write by `endpointRuleSchema`). */
const ruleView = z.object({
	match: z.object({
		source: z.enum(RULE_SOURCES),
		key: z.string().optional(),
		path: z.string().optional(),
	}),
	op: z.enum(RULE_OPS),
	value: z.union([z.string(), z.number()]).optional(),
	response: z.object({
		status: z.number().int(),
		body: z.unknown().optional(),
		headers: z.array(z.object({ name: z.string(), value: z.string() })),
	}),
});

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
			/** Absent: no chaos. */
			chaos: chaosView.optional(),
			/** Absent: no conditional rules. */
			rules: z.array(ruleView).optional(),
		}),
	),
	/** Number of records. */
	count: z.number().int().min(0),
	/**
	 * Bumped by every update of the resource; the mock runtime counts the
	 * `nth` request of a rule per revision, so saving starts again at 1.
	 */
	revision: z.number().int().min(0),
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
			...(endpoint.chaos ? { chaos: endpoint.chaos } : {}),
			...(endpoint.rules?.length ? { rules: [...endpoint.rules] } : {}),
		})),
		count: resource.count,
		revision: resource.revision ?? 0,
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
