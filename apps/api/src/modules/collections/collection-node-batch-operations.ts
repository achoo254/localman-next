import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	EDITORS,
	NODES_PATH,
	NODE_MISSING,
	NODE_PATH,
} from "./collection-node-operations.js";
import {
	ACCESS_NOTE,
	collectionIdSchema,
} from "./collection-read-operations.js";
import { AGENT_READ_NOTE, nodeForCaller } from "./collection-secret-mask.js";
import { collectionNodeView } from "./collection-view.js";
import { nodeIdSchema } from "./node-create-input.js";
import { deleteNodes } from "./node-delete-service.js";
import { duplicateNode } from "./node-duplicate-service.js";

/** Most nodes one bulk deletion names. */
export const BULK_NODES_MAX = 200;

const deletionView = z.object({
	dryRun: z.boolean(),
	deleted: z.boolean(),
	folders: z.number().int(),
	requests: z.number().int(),
	examples: z.number().int(),
	/** Too large to keep a diff: cannot be undone, blocks older restores. */
	irreversible: z.boolean(),
});
const IRREVERSIBLE =
	"`irreversible` (also on dryRun) is true when the deletion is too large for the changelog to keep its diff: it then cannot be undone and blocks restoring older changes.";

export const deleteCollectionNodeOperation = defineOperation({
	id: "client.deleteCollectionNode",
	method: "DELETE",
	path: NODE_PATH,
	summary: "Delete a folder, request or example with everything under it",
	description: `${EDITORS} Deletes the node and its whole subtree for good (a request takes its examples along); dryRun returns how many folders, requests and examples would go. ${IRREVERSIBLE} ${NODE_MISSING} ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema, nodeId: nodeIdSchema }),
	output: deletionView.extend({ nodeId: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) => ({
		nodeId: input.nodeId,
		...(await deleteNodes(
			requireSubject(ctx),
			input.collectionId,
			[input.nodeId],
			ctx.dryRun,
		)),
	}),
});

export const duplicateCollectionNodeOperation = defineOperation({
	id: "client.duplicateCollectionNode",
	method: "POST",
	path: `${NODE_PATH}/duplicate`,
	summary: "Duplicate a folder, request or example with everything under it",
	description: `${EDITORS} Copies the node and its subtree right after it, named "<name> Copy", with new ids, in one step: 409 COLLECTION_NODES_LIMIT or 413 COLLECTION_TOO_LARGE write nothing. Returns the new nodes (the copy of the node first, parents before children) to add to the collection as is. ${NODE_MISSING} ${ACCESS_NOTE} ${AGENT_READ_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema, nodeId: nodeIdSchema }),
	output: z.object({ nodes: z.array(collectionNodeView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const nodes = await duplicateNode(
			requireSubject(ctx),
			input.collectionId,
			input.nodeId,
		);
		return { nodes: nodes.map((node) => nodeForCaller(ctx, node)) };
	},
});

export const bulkDeleteCollectionNodesOperation = defineOperation({
	id: "client.bulkDeleteCollectionNodes",
	method: "POST",
	path: `${NODES_PATH}/bulk-delete`,
	summary: "Delete several folders, requests or examples at once",
	description: `${EDITORS} Deletes up to ${BULK_NODES_MAX} nodes with their subtrees in one step: all of them, or none when one is missing (404 NODE_NOT_FOUND). A node inside another listed node's subtree goes with it. dryRun counts what would go. ${IRREVERSIBLE} ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		nodeIds: z.array(nodeIdSchema).min(1).max(BULK_NODES_MAX),
	}),
	output: deletionView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) =>
		deleteNodes(
			requireSubject(ctx),
			input.collectionId,
			input.nodeIds,
			ctx.dryRun,
		),
});

export const collectionNodeBatchOperations = [
	deleteCollectionNodeOperation,
	duplicateCollectionNodeOperation,
	bulkDeleteCollectionNodesOperation,
] as const;
