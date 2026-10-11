import { OperationError, defineOperation } from "@localman/operations";
import {
	COLLECTION_DEPTH_MAX,
	COLLECTION_NAME_MAX,
	apiRequestDraftSchema,
	nodeMoveSchema,
	nodeUpdateSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { DRAFT_BODY_LIMIT } from "../api-client/draft-size.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "./collection-read-operations.js";
import { collectionNodeView } from "./collection-view.js";
import { duplicateNode } from "./node-duplicate-service.js";
import { deleteNode, updateNode } from "./node-edit-service.js";
import { moveNode } from "./node-move-service.js";
import { type NodeCreate, createNode } from "./node-service.js";

const NODES_PATH = `${COLLECTION_PATH}/nodes`;
const NODE_PATH = `${NODES_PATH}/:nodeId`;
const nodeIdSchema = z.string().min(1).max(64);
const EDITORS = "Editors of the collection.";
const NODE_MISSING =
	"404 NODE_NOT_FOUND for a folder or request not in this collection.";
const PARENT_NOTE = `\`parentId\` is a folder of this collection or null for the top (400 INVALID_PARENT); folders nest at most ${COLLECTION_DEPTH_MAX} levels (400 COLLECTION_TOO_DEEP).`;

/**
 * The body of a new node, flat as \`nodeCreateSchema\` describes it (an
 * operation input must be one object, not a union): a request needs a
 * draft, a folder takes none.
 */
const createNodeInput = z.object({
	collectionId: collectionIdSchema,
	kind: z.enum(["folder", "request"]),
	parentId: nodeIdSchema.nullable(),
	name: z.string().trim().min(1).max(COLLECTION_NAME_MAX),
	afterId: nodeIdSchema.nullable().optional(),
	draft: apiRequestDraftSchema.optional(),
});

function nodeOf(input: z.infer<typeof createNodeInput>): NodeCreate {
	const { kind, parentId, name, afterId, draft } = input;
	if (kind === "folder") {
		if (draft !== undefined) {
			throw new OperationError(
				400,
				"INVALID_NODE_FIELDS",
				"A folder has no draft",
				{ fields: "draft" },
			);
		}
		return { kind, parentId, name, afterId };
	}
	if (draft === undefined) {
		throw new OperationError(400, "VALIDATION_ERROR", "Invalid input", [
			{ path: "draft", message: "A request needs a draft" },
		]);
	}
	return { kind, parentId, name, afterId, draft };
}

export const createCollectionNodeOperation = defineOperation({
	id: "client.createCollectionNode",
	method: "POST",
	path: NODES_PATH,
	summary: "Add a folder or request to a collection",
	description: `${EDITORS} \`kind: "folder"\` with a name, or \`kind: "request"\` with a name and its draft (method, url, params, headers, auth, body, scripts, settings). Goes after \`afterId\` (a sibling, 400 INVALID_POSITION otherwise) or last. ${PARENT_NOTE} 409 COLLECTION_NODES_LIMIT when the collection is full; 413 DRAFT_TOO_LARGE. ${ACCESS_NOTE}`,
	input: createNodeInput,
	output: collectionNodeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	bodyLimit: DRAFT_BODY_LIMIT,
	handler: async (ctx, input) =>
		createNode(requireSubject(ctx), input.collectionId, nodeOf(input)),
});

export const updateCollectionNodeOperation = defineOperation({
	id: "client.updateCollectionNode",
	method: "PATCH",
	path: NODE_PATH,
	summary: "Edit a folder or request of a collection",
	description: `${EDITORS} Omitted fields stay. Folders take name, description, auth (\`inherit\` takes the parent's) and scripts; requests take name, description and draft (400 INVALID_NODE_FIELDS for a field of the other kind). ${NODE_MISSING} ${ACCESS_NOTE}`,
	input: nodeUpdateSchema.extend({
		collectionId: collectionIdSchema,
		nodeId: nodeIdSchema,
	}),
	output: collectionNodeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: DRAFT_BODY_LIMIT,
	handler: async (ctx, input) => {
		const { collectionId, nodeId, ...update } = input;
		return updateNode(requireSubject(ctx), collectionId, nodeId, update);
	},
});

export const moveCollectionNodeOperation = defineOperation({
	id: "client.moveCollectionNode",
	method: "POST",
	path: `${NODE_PATH}/move`,
	summary: "Move a folder or request within a collection",
	description: `${EDITORS} Drops the node under \`parentId\` between the siblings whose order keys are \`beforeOrder\` and \`afterOrder\` (null at either end); only the moved node is rewritten. 400 INVALID_ORDER unless beforeOrder < afterOrder are valid keys; 400 MOVE_CYCLE for a folder moved into itself or its subfolders. ${PARENT_NOTE} ${NODE_MISSING} ${ACCESS_NOTE}`,
	input: nodeMoveSchema.extend({
		collectionId: collectionIdSchema,
		nodeId: nodeIdSchema,
	}),
	output: collectionNodeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => {
		const { collectionId, nodeId, ...move } = input;
		return moveNode(requireSubject(ctx), collectionId, nodeId, move);
	},
});

export const deleteCollectionNodeOperation = defineOperation({
	id: "client.deleteCollectionNode",
	method: "DELETE",
	path: NODE_PATH,
	summary: "Delete a folder or request with everything under it",
	description: `${EDITORS} Deletes the node and its whole subtree for good; dryRun returns how many folders and requests would go. ${NODE_MISSING} ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema, nodeId: nodeIdSchema }),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		nodeId: z.string(),
		folders: z.number().int(),
		requests: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) =>
		deleteNode(
			requireSubject(ctx),
			input.collectionId,
			input.nodeId,
			ctx.dryRun,
		),
});

export const duplicateCollectionNodeOperation = defineOperation({
	id: "client.duplicateCollectionNode",
	method: "POST",
	path: `${NODE_PATH}/duplicate`,
	summary: "Duplicate a folder or request with everything under it",
	description: `${EDITORS} Copies the node and its subtree right after it, named "<name> Copy", with new ids, in one step: 409 COLLECTION_NODES_LIMIT or 413 COLLECTION_TOO_LARGE write nothing. Returns the new nodes (the copy of the node first, parents before children) to add to the collection as is. ${NODE_MISSING} ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema, nodeId: nodeIdSchema }),
	output: z.object({ nodes: z.array(collectionNodeView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => ({
		nodes: await duplicateNode(
			requireSubject(ctx),
			input.collectionId,
			input.nodeId,
		),
	}),
});

export const collectionNodeOperations = [
	createCollectionNodeOperation,
	updateCollectionNodeOperation,
	moveCollectionNodeOperation,
	deleteCollectionNodeOperation,
	duplicateCollectionNodeOperation,
] as const;
