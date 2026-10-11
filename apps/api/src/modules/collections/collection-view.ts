import { ELEMENT_ROLES, type ElementRole } from "@localman/shared/access";
import {
	type CollectionDetail,
	type CollectionNode,
	apiRequestDraftSchema,
	effectiveAuthSchema,
	requestAuthSchema,
	requestScriptsSchema,
	variableEntrySchema,
} from "@localman/shared/api-client";
import { z } from "zod";
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
]);

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
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	nodes: z.array(collectionNodeView),
});

export const collectionSummaryView = z.object({
	id: z.string(),
	workspaceId: z.string(),
	role: roleView,
	name: z.string(),
	favorite: z.boolean(),
	requestCount: z.number().int(),
	updatedAt: z.string(),
});

export function toCollectionNode(node: StoredCollectionNode): CollectionNode {
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
 * it leaves Localman.
 */
export function toCollectionDetail(
	root: StoredCollection,
	nodes: readonly StoredCollectionNode[],
	role: ElementRole,
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
		createdBy: root.createdBy,
		createdAt: root.createdAt.toISOString(),
		updatedAt: root.updatedAt.toISOString(),
		nodes: nodes.map(toCollectionNode),
	};
}
