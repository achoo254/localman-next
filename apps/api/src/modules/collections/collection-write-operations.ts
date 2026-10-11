import { defineOperation } from "@localman/operations";
import {
	COLLECTION_NAME_MAX,
	COLLECTION_NODES_MAX,
	DELETE_CONFIRMATION,
	MAX_IMPORT_BYTES,
	collectionUpdateSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
	workspaceIdSchema,
} from "./collection-read-operations.js";
import {
	createCollection,
	duplicateCollection,
	updateCollection,
} from "./collection-service.js";
import { COLLECTIONS_PER_WORKSPACE_MAX } from "./collection-store.js";
import { collectionTreeSchema } from "./collection-tree-input.js";
import { collectionDetailView } from "./collection-view.js";
import { COLLECTION_TEMPLATES } from "./rest-crud-template.js";
import { trashCollection } from "./trash-service.js";

const MIB = 1024 * 1024;
/** An import file of `MAX_IMPORT_BYTES`, plus the defaults its tree spells out. */
const TREE_BODY_LIMIT = MAX_IMPORT_BYTES + 2 * MIB;
/** 200 variables of up to 10,000 characters, scripts and description. */
const ROOT_BODY_LIMIT = 3 * MIB;
const LIMITS_NOTE = `409 COLLECTION_LIMIT_REACHED past ${COLLECTIONS_PER_WORKSPACE_MAX} collections in the workspace, 409 COLLECTION_NODES_LIMIT past ${COLLECTION_NODES_MAX} folders and requests, 413 DRAFT_TOO_LARGE for a request above the saved-draft cap.`;

export const createCollectionOperation = defineOperation({
	id: "client.createCollection",
	method: "POST",
	path: "/workspaces/:workspaceId/collections",
	summary: "Create a collection in a workspace",
	description: `Admins and Editors of the workspace. Send \`name\` for an empty collection, \`template: "rest-crud"\` for a folder of list, get, create, update and delete requests on {{baseUrl}}/items, or \`tree\` (an imported collection: folders, requests, auth, scripts, variables); \`name\` also renames a template or tree. ${LIMITS_NOTE} 404 NOT_FOUND for a workspace the caller is not in.`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		name: z.string().trim().min(1).max(COLLECTION_NAME_MAX).optional(),
		template: z.enum(COLLECTION_TEMPLATES).optional(),
		tree: collectionTreeSchema.optional(),
	}),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	bodyLimit: TREE_BODY_LIMIT,
	handler: async (ctx, input) => {
		const { workspaceId, ...source } = input;
		return createCollection(requireSubject(ctx), workspaceId, source);
	},
});

export const updateCollectionOperation = defineOperation({
	id: "client.updateCollection",
	method: "PATCH",
	path: COLLECTION_PATH,
	summary: "Edit a collection's name, description, auth, scripts or variables",
	description: `Editors. Omitted fields stay. \`auth\` is what top-level items inheriting auth receive (never \`inherit\` itself); scripts run before the folder's and the request's. ${ACCESS_NOTE}`,
	input: collectionUpdateSchema.extend({ collectionId: collectionIdSchema }),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: ROOT_BODY_LIMIT,
	handler: async (ctx, input) => {
		const { collectionId, ...update } = input;
		return updateCollection(requireSubject(ctx), collectionId, update);
	},
});

export const duplicateCollectionOperation = defineOperation({
	id: "client.duplicateCollection",
	method: "POST",
	path: `${COLLECTION_PATH}/duplicate`,
	summary: "Duplicate a collection",
	description: `Copies the collection as "<name> Copy" with new folder and request ids into \`workspaceId\` (its own workspace by default), where the caller must be Admin or Editor. Viewers of the collection may duplicate it. ${LIMITS_NOTE} ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		workspaceId: workspaceIdSchema.optional(),
	}),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) =>
		duplicateCollection(
			requireSubject(ctx),
			input.collectionId,
			input.workspaceId,
		),
});

export const deleteCollectionOperation = defineOperation({
	id: "client.deleteCollection",
	method: "DELETE",
	path: COLLECTION_PATH,
	summary: "Move a collection to the trash",
	description: `Needs the Editor role on the collection and Admin or Editor in its workspace (a share alone is not enough). A collection holding requests needs \`confirm: "${DELETE_CONFIRMATION}"\` (400 CONFIRMATION_REQUIRED otherwise); dryRun shows its folder and request counts without it. It stays in the trash until \`purgeAt\`, restorable with restore_collection. 409 WORKSPACE_MISSING when its workspace is gone. ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		confirm: z.string().max(20).optional(),
	}),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		collectionId: z.string(),
		name: z.string(),
		folders: z.number().int(),
		requests: z.number().int(),
		purgeAt: z.string(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) =>
		trashCollection(
			requireSubject(ctx),
			input.collectionId,
			input.confirm,
			ctx.dryRun,
		),
});

export const collectionWriteOperations = [
	createCollectionOperation,
	updateCollectionOperation,
	duplicateCollectionOperation,
	deleteCollectionOperation,
] as const;
