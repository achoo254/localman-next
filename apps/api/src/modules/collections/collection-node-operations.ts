import { defineOperation } from "@localman/operations";
import {
	COLLECTION_DEPTH_MAX,
	EXAMPLE_BODY_MAX,
	nodeMoveSchema,
	nodeUpdateSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import {
	USER_SCOPE,
	isAgentCall,
	requireSubject,
} from "../../http/require-auth.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "./collection-read-operations.js";
import {
	AGENT_READ_NOTE,
	AGENT_WRITE_NOTE,
	nodeForCaller,
} from "./collection-secret-mask.js";
import { collectionNodeView } from "./collection-view.js";
import {
	NODE_BODY_LIMIT,
	createNodeInput,
	nodeIdSchema,
	nodeOf,
} from "./node-create-input.js";
import { updateNode } from "./node-edit-service.js";
import { moveNode } from "./node-move-service.js";
import { createNode } from "./node-service.js";

export const NODES_PATH = `${COLLECTION_PATH}/nodes`;
export const NODE_PATH = `${NODES_PATH}/:nodeId`;
export const EDITORS = "Editors of the collection.";
export const NODE_MISSING =
	"404 NODE_NOT_FOUND for a folder, request or example not in this collection.";
const PARENT_NOTE = `\`parentId\` is a folder of this collection or null for the top (400 INVALID_PARENT); folders nest at most ${COLLECTION_DEPTH_MAX} levels (400 COLLECTION_TOO_DEEP).`;

export const createCollectionNodeOperation = defineOperation({
	id: "client.createCollectionNode",
	method: "POST",
	path: NODES_PATH,
	summary: "Add a folder, request or example to a collection",
	description: `${EDITORS} \`kind: "folder"\` with a name; \`kind: "request"\` with a name and its draft (method, url, params, headers, auth, body, scripts, settings); \`kind: "example"\` with a name, \`parentId\` a request node, the \`request\` sent and the \`response\` saved (status 100-599, statusText, headers, body of at most ${EXAMPLE_BODY_MAX} bytes of UTF-8, else 400 VALIDATION_ERROR; cut it before sending). Goes after \`afterId\` (a sibling, 400 INVALID_POSITION otherwise) or last. ${PARENT_NOTE} 409 COLLECTION_NODES_LIMIT when the collection is full; 413 DRAFT_TOO_LARGE or COLLECTION_TOO_LARGE. ${ACCESS_NOTE} ${AGENT_READ_NOTE}`,
	input: createNodeInput,
	output: collectionNodeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	bodyLimit: NODE_BODY_LIMIT,
	handler: async (ctx, input) =>
		nodeForCaller(
			ctx,
			await createNode(requireSubject(ctx), input.collectionId, nodeOf(input)),
		),
});

export const updateCollectionNodeOperation = defineOperation({
	id: "client.updateCollectionNode",
	method: "PATCH",
	path: NODE_PATH,
	summary: "Edit a folder, request or example of a collection",
	description: `${EDITORS} Omitted fields stay. Folders take name, description, auth (\`inherit\` takes the parent's) and scripts; requests take name, description and draft; examples take name, request and response (400 INVALID_NODE_FIELDS for a field of another kind; 413 DRAFT_TOO_LARGE, COLLECTION_TOO_LARGE). ${NODE_MISSING} ${ACCESS_NOTE} ${AGENT_READ_NOTE} ${AGENT_WRITE_NOTE}`,
	input: nodeUpdateSchema.extend({
		collectionId: collectionIdSchema,
		nodeId: nodeIdSchema,
	}),
	output: collectionNodeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: NODE_BODY_LIMIT,
	handler: async (ctx, input) => {
		const { collectionId, nodeId, ...update } = input;
		const node = await updateNode(
			requireSubject(ctx),
			collectionId,
			nodeId,
			update,
			isAgentCall(ctx),
		);
		return nodeForCaller(ctx, node);
	},
});

export const moveCollectionNodeOperation = defineOperation({
	id: "client.moveCollectionNode",
	method: "POST",
	path: `${NODE_PATH}/move`,
	summary: "Move a folder, request or example within a collection",
	description: `${EDITORS} Drops the node under \`parentId\` between the siblings whose order keys are \`beforeOrder\` and \`afterOrder\` (null at either end); only the moved node is rewritten. An example only reorders under its own request (400 INVALID_PARENT for another parent). 400 INVALID_ORDER unless beforeOrder < afterOrder are valid keys; 400 MOVE_CYCLE for a folder moved into itself or its subfolders. ${PARENT_NOTE} ${NODE_MISSING} ${ACCESS_NOTE} ${AGENT_READ_NOTE}`,
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
		return nodeForCaller(
			ctx,
			await moveNode(requireSubject(ctx), collectionId, nodeId, move),
		);
	},
});

export const collectionNodeOperations = [
	createCollectionNodeOperation,
	updateCollectionNodeOperation,
	moveCollectionNodeOperation,
] as const;
