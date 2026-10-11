import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	collectionIdSchema,
	workspaceIdSchema,
} from "./collection-read-operations.js";
import { COLLECTIONS_PER_WORKSPACE_MAX } from "./collection-store.js";
import { collectionDetailView } from "./collection-view.js";
import { TRASH_RETENTION_DAYS } from "./trash-access.js";
import { deletePermanently } from "./trash-purge.js";
import {
	TRASH_LIST_MAX,
	listTrash,
	restoreCollection,
} from "./trash-restore-service.js";
import { trashedView } from "./trash-view.js";

const TRASH_PATH = "/trash/collections/:collectionId";
const MANAGERS =
	"Allowed for whoever deleted it and for Admins and Editors of the workspace it was deleted from; 404 NOT_FOUND for others and for collections not in the trash.";

export const listTrashedCollectionsOperation = defineOperation({
	id: "client.listTrashedCollections",
	method: "GET",
	path: "/trash/collections",
	summary: "List deleted collections the caller can restore",
	description: `Collections in the trash of workspaces where the caller is Admin or Editor, and those the caller deleted (also after their workspace was deleted), newest first, at most ${TRASH_LIST_MAX}. \`workspaceId\` narrows to one original workspace. Each is purged for good at \`purgeAt\`, ${TRASH_RETENTION_DAYS} days after deletion.`,
	input: z.object({ workspaceId: workspaceIdSchema.optional() }),
	output: z.object({ items: z.array(trashedView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listTrash(requireSubject(ctx), input.workspaceId),
	}),
});

export const restoreCollectionOperation = defineOperation({
	id: "client.restoreCollection",
	method: "POST",
	path: `${TRASH_PATH}/restore`,
	summary: "Restore a deleted collection into a workspace",
	description: `Restores it with its folders, requests and shares into \`workspaceId\`, where the caller must be Admin or Editor (its original workspace while it exists, or another one). 409 TEAM_TO_PERSONAL for a team collection going to a personal workspace while its team workspace exists; 409 COLLECTION_LIMIT_REACHED past ${COLLECTIONS_PER_WORKSPACE_MAX} collections. ${MANAGERS}`,
	input: z.object({
		collectionId: collectionIdSchema,
		workspaceId: workspaceIdSchema,
	}),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		restoreCollection(
			requireSubject(ctx),
			input.collectionId,
			input.workspaceId,
		),
});

export const deleteTrashedCollectionOperation = defineOperation({
	id: "client.deleteTrashedCollection",
	method: "DELETE",
	path: TRASH_PATH,
	summary: "Permanently delete a collection from the trash",
	description: `Deletes it for good with its folders, requests, favorites, shares and access requests; it cannot be restored afterwards. dryRun shows it and its node count. ${MANAGERS}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		collection: trashedView,
		nodes: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) =>
		deletePermanently(requireSubject(ctx), input.collectionId, ctx.dryRun),
});

export const collectionTrashOperations = [
	listTrashedCollectionsOperation,
	restoreCollectionOperation,
	deleteTrashedCollectionOperation,
] as const;
