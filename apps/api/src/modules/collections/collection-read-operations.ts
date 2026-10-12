import { defineOperation } from "@localman/operations";
import {
	exportCollectionV21,
	nodesToCollectionTree,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "./collection-access.js";
import { listCollections } from "./collection-list-service.js";
import { getCollection } from "./collection-service.js";
import { loadCollectionDetail } from "./collection-store.js";
import {
	collectionDetailView,
	collectionSummaryView,
} from "./collection-view.js";

export const collectionIdSchema = z.string().min(1).max(64);
export const workspaceIdSchema = z.string().min(1).max(64);
export const COLLECTION_PATH = "/collections/:collectionId";
export const ACCESS_NOTE =
	"404 NOT_FOUND when the collection does not exist, is in the trash or the caller holds no role on it (workspace role or share); 403 FORBIDDEN when their role does not allow it.";

export const listCollectionsOperation = defineOperation({
	id: "client.listCollections",
	method: "GET",
	path: "/workspaces/:workspaceId/collections",
	summary: "List the collections of a workspace",
	description:
		"Live collections of the workspace with their request count and last update, the caller's favorites first, then by name. Members see every collection; others only those shared with them (404 NOT_FOUND when there are none).",
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: z.object({ items: z.array(collectionSummaryView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listCollections(requireSubject(ctx), input.workspaceId),
	}),
});

export const getCollectionOperation = defineOperation({
	id: "client.getCollection",
	method: "GET",
	path: COLLECTION_PATH,
	summary: "Get a collection with its folders and requests",
	description: `The root (description, auth, scripts, variables the items inherit) and every folder and request as a flat list linked by parentId and ordered by \`order\` (compare as plain strings) within each parent. \`mockProject\` and \`relatedEnvironment\` (the linked environment, else the one shared with it: \`source\`) are \`null\` when none, gone or not readable by the caller. ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		getCollection(requireSubject(ctx), input.collectionId),
});

/** A Collection v2.1 document; its items are written by the shared exporter. */
const collectionV21View = z.looseObject({
	info: z.looseObject({ name: z.string(), schema: z.string() }),
	item: z.array(z.unknown()),
});

export const exportCollectionOperation = defineOperation({
	id: "client.exportCollection",
	method: "GET",
	path: `${COLLECTION_PATH}/export`,
	summary: "Export a collection as Collection v2.1 JSON",
	description: `The collection in the Collection v2.1 format (folders, requests, auth, scripts, variables), as other API clients import it. Viewers may export. ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: collectionV21View,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { collectionId, role } = await requireCollection(
			sub,
			input.collectionId,
			"export",
		);
		// Links stay out of the file: no need to resolve them.
		const detail = await loadCollectionDetail(collectionId, role, null);
		const v21 = exportCollectionV21(nodesToCollectionTree(detail));
		// Plain object copies: interfaces lack the index signature of the view.
		return { ...v21, info: { ...v21.info } };
	},
});

export const collectionReadOperations = [
	listCollectionsOperation,
	getCollectionOperation,
	exportCollectionOperation,
] as const;
