import { defineOperation } from "@localman/operations";
import { DELETE_CONFIRMATION } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { trashCollections } from "./bulk-trash-service.js";
import {
	collectionIdSchema,
	workspaceIdSchema,
} from "./collection-read-operations.js";
import {
	AGENT_READ_NOTE,
	collectionForCaller,
} from "./collection-secret-mask.js";
import { COLLECTIONS_PER_WORKSPACE_MAX } from "./collection-store.js";
import { collectionDetailView } from "./collection-view.js";
import { TRASH_RETENTION_DAYS } from "./trash-access.js";
import { TRASH_LIST_MAX, listTrash } from "./trash-list-service.js";
import { deletePermanently } from "./trash-purge.js";
import { restoreCollection } from "./trash-restore-service.js";
import { trashListView, trashedView } from "./trash-view.js";

const TRASH_PATH = "/trash/collections/:collectionId";
/** Most collections one bulk trash names. */
const BULK_TRASH_MAX = 100;
const MANAGERS =
	"Allowed for current Admins and Editors of the workspace it was deleted from; once that workspace is deleted too, for whoever deleted the collection and the workspace's Admins and Editors at that moment. 404 NOT_FOUND for others and for collections not in the trash.";

export const listTrashedCollectionsOperation = defineOperation({
	id: "client.listTrashedCollections",
	method: "GET",
	path: "/trash/collections",
	summary: "List deleted collections the caller can restore",
	description: `Collections in the trash the caller may restore (see restore_collection), newest first, at most ${TRASH_LIST_MAX}. Filters: \`workspaceId\` (the workspace it was deleted from), \`deletedBy\` (user id), \`q\` (part of the name, case and accents ignored). \`deleters\` lists who deleted anything there, for the filter. Each is purged for good at \`purgeAt\`, ${TRASH_RETENTION_DAYS} days after deletion.`,
	input: z.object({
		workspaceId: workspaceIdSchema.optional(),
		deletedBy: z.string().min(1).max(200).optional(),
		q: z.string().trim().min(1).max(100).optional(),
	}),
	output: trashListView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => listTrash(requireSubject(ctx), input),
});

export const restoreCollectionOperation = defineOperation({
	id: "client.restoreCollection",
	method: "POST",
	path: `${TRASH_PATH}/restore`,
	summary: "Restore a deleted collection into a workspace",
	description: `Restores it with its folders, requests and shares into \`workspaceId\`, where the caller must be Admin or Editor (its original workspace while it exists, or another one). 409 TEAM_TO_PERSONAL for a team collection going to a personal workspace while its team workspace exists; 409 COLLECTION_LIMIT_REACHED past ${COLLECTIONS_PER_WORKSPACE_MAX} collections. ${MANAGERS} ${AGENT_READ_NOTE}`,
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
		collectionForCaller(
			ctx,
			await restoreCollection(
				requireSubject(ctx),
				input.collectionId,
				input.workspaceId,
			),
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

const trashingView = z.object({
	collectionId: z.string(),
	name: z.string(),
	folders: z.number().int(),
	requests: z.number().int(),
	purgeAt: z.string(),
});

export const bulkTrashCollectionsOperation = defineOperation({
	id: "client.bulkTrashCollections",
	method: "POST",
	path: "/workspaces/:workspaceId/collections/bulk-trash",
	summary: "Move several collections of a workspace to the trash",
	description: `Admins and Editors of the workspace, with the Editor role on each collection (like delete_collection). Up to ${BULK_TRASH_MAX} collections of this workspace go together or none does (404 NOT_FOUND when one is missing or elsewhere). \`confirm: "${DELETE_CONFIRMATION}"\` is needed when any holds requests (400 CONFIRMATION_REQUIRED); dryRun lists them with their counts.`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		collectionIds: z.array(collectionIdSchema).min(1).max(BULK_TRASH_MAX),
		confirm: z.string().max(20).optional(),
	}),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		collections: z.array(trashingView),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) =>
		trashCollections(
			requireSubject(ctx),
			input.workspaceId,
			input.collectionIds,
			input.confirm,
			ctx.dryRun,
		),
});

export const collectionTrashOperations = [
	listTrashedCollectionsOperation,
	restoreCollectionOperation,
	deleteTrashedCollectionOperation,
	bulkTrashCollectionsOperation,
] as const;
