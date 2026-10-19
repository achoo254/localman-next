import { ELEMENT_ROLES, type ElementRole } from "@localman/shared/access";
import {
	COLLECTION_STATUS_PRESETS,
	type CollectionDetail,
	type CollectionNode,
	ENVIRONMENT_COLORS,
	apiRequestDraftSchema,
	effectiveAuthSchema,
	exampleResponseSchema,
	requestAuthSchema,
	requestScriptsSchema,
	variableEntrySchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import type { CollectionLinks } from "./collection-links.js";
import type { StoredCollection } from "./collection-model.js";
import type { StoredCollectionNode } from "./collection-node-model.js";

const nodeBase = {
	id: z.string(),
	parentId: z.string().nullable(),
	order: z.string(),
	name: z.string(),
	description: z.string(),
};

export const collectionNodeView = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("folder"),
		...nodeBase,
		auth: requestAuthSchema,
		scripts: requestScriptsSchema,
	}),
	z.object({
		kind: z.literal("request"),
		...nodeBase,
		draft: apiRequestDraftSchema,
	}),
	z.object({
		kind: z.literal("example"),
		id: z.string(),
		parentId: z.string(),
		order: z.string(),
		name: z.string(),
		request: apiRequestDraftSchema,
		response: exampleResponseSchema,
	}),
]);

/** Output form of tags and status (input parsing normalizes them). */
export const tagsView = z.array(z.string());
export const statusView = z
	.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("preset"),
			preset: z.enum(COLLECTION_STATUS_PRESETS),
		}),
		z.object({
			kind: z.literal("custom"),
			name: z.string(),
			emoji: z.string(),
		}),
	])
	.nullable();

const roleView = z.enum(ELEMENT_ROLES);

export const collectionDetailView = z.object({
	id: z.string(),
	workspaceId: z.string(),
	role: roleView,
	name: z.string(),
	description: z.string(),
	auth: effectiveAuthSchema,
	scripts: requestScriptsSchema,
	variables: z.array(variableEntrySchema),
	tags: tagsView,
	status: statusView,
	createdBy: z.string(),
	createdByName: z.string().nullable(),
	createdAt: z.string(),
	updatedBy: z.string(),
	updatedByName: z.string().nullable(),
	updatedAt: z.string(),
	mockProject: z.object({ id: z.string(), name: z.string() }).nullable(),
	relatedEnvironment: z
		.object({
			id: z.string(),
			name: z.string(),
			color: z.enum(ENVIRONMENT_COLORS),
			source: z.enum(["linked", "shared"]),
		})
		.nullable(),
	nodes: z.array(collectionNodeView),
});

export const collectionSummaryView = z.object({
	id: z.string(),
	workspaceId: z.string(),
	role: roleView,
	name: z.string(),
	favorite: z.boolean(),
	requestCount: z.number().int(),
	tags: tagsView,
	status: statusView,
	updatedAt: z.string(),
});

export function toCollectionNode(node: StoredCollectionNode): CollectionNode {
	if (node.kind === "example") {
		const { name, order, request, response } = node;
		const parentId = node.parentId.toHexString();
		return {
			kind: "example",
			id: node._id.toHexString(),
			parentId,
			order,
			name,
			request,
			response,
		};
	}
	const base = {
		id: node._id.toHexString(),
		parentId: node.parentId ? node.parentId.toHexString() : null,
		order: node.order,
		name: node.name,
		description: node.description,
	};
	if (node.kind === "request") {
		return { kind: "request", ...base, draft: node.draft };
	}
	return { kind: "folder", ...base, auth: node.auth, scripts: node.scripts };
}

/**
 * The collection with its nodes. Every node write also updates the root,
 * so its `updatedAt` is the collection's last change.
 *
 * Secret variable values and auth credentials are returned as stored to
 * everyone who may view the collection: "secret" is a masking flag for
 * the UI, not an access level. Only an exported file blanks them, since
 * it leaves Localman, and an agent's read (`collection-secret-mask.ts`).
 * `links` are resolved for the caller beforehand.
 */
export function toCollectionDetail(
	root: StoredCollection,
	nodes: readonly StoredCollectionNode[],
	role: ElementRole,
	names: ReadonlyMap<string, string>,
	links: CollectionLinks,
): CollectionDetail {
	return {
		id: root._id.toHexString(),
		workspaceId: root.workspaceId.toHexString(),
		role,
		name: root.name,
		description: root.description,
		auth: root.auth,
		scripts: root.scripts,
		variables: root.variables,
		tags: [...(root.tags ?? [])],
		status: root.status ?? null,
		createdBy: root.createdBy,
		createdByName: names.get(root.createdBy) ?? null,
		createdAt: root.createdAt.toISOString(),
		updatedBy: root.updatedBy,
		updatedByName: names.get(root.updatedBy) ?? null,
		updatedAt: root.updatedAt.toISOString(),
		mockProject: links.mockProject,
		relatedEnvironment: links.relatedEnvironment,
		nodes: nodes.map(toCollectionNode),
	};
}
