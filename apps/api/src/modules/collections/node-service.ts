import { OperationError } from "@localman/operations";
import {
	COLLECTION_DEPTH_MAX,
	COLLECTION_NODES_MAX,
	type CollectionNode,
	type nodeCreateSchema,
	orderKeyBetween,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import type { z } from "zod";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { nodeBytes } from "./collection-bytes.js";
import { toObjectId } from "./collection-ids.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import {
	assertNodeSize,
	nodesLimitReached,
	storedNodeOf,
} from "./collection-store.js";
import { toCollectionNode } from "./collection-view.js";
import { type Outline, folderDepth, loadOutline } from "./node-outline.js";
import { nodesRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";

export type NodeCreate = z.infer<typeof nodeCreateSchema>;

export function nodeNotFound(): OperationError {
	return new OperationError(
		404,
		"NODE_NOT_FOUND",
		"Folder or request not found",
	);
}

function badRequest(code: string, message: string): OperationError {
	return new OperationError(400, code, message);
}

export function tooDeep(): OperationError {
	return badRequest(
		"COLLECTION_TOO_DEEP",
		`Folders nest at most ${COLLECTION_DEPTH_MAX} levels deep`,
	);
}

/**
 * The parent fits the child: a folder of this collection or the top for a
 * folder or request, a request of this collection for an example.
 */
export function assertParent(
	outline: Outline,
	parentId: string | null,
	childKind: CollectionNode["kind"] = "folder",
): void {
	const parentKind = parentId === null ? null : outline.get(parentId)?.kind;
	if (
		childKind === "example"
			? parentKind === "request"
			: parentId === null || parentKind === "folder"
	) {
		return;
	}
	throw badRequest(
		"INVALID_PARENT",
		childKind === "example"
			? "An example belongs to a request of the same collection"
			: "The parent must be a folder of the same collection",
	);
}

/** The node of this collection; 404 `NODE_NOT_FOUND` otherwise. */
export async function findNode(
	collectionId: Types.ObjectId,
	nodeId: string,
	session?: ClientSession,
): Promise<StoredCollectionNode> {
	const _id = toObjectId(nodeId);
	const node = _id
		? await CollectionNodeModel.findOne({ _id, collectionId })
				.session(session ?? null)
				.lean<StoredCollectionNode>()
		: null;
	if (!node) throw nodeNotFound();
	return node;
}

const parentKey = (parentId: string | null) =>
	parentId === null ? null : new Types.ObjectId(parentId);

/** The order key of a new node: after `afterId`, or last among its siblings. */
async function newOrder(
	collectionId: Types.ObjectId,
	input: NodeCreate,
	session: ClientSession,
): Promise<string> {
	const siblings = { collectionId, parentId: parentKey(input.parentId) };
	if (input.afterId === undefined || input.afterId === null) {
		const last = await CollectionNodeModel.findOne(siblings, { order: 1 })
			.session(session)
			.sort({ order: -1 })
			.lean<{ order: string }>();
		return orderKeyBetween(last?.order ?? null, null);
	}
	const afterKey = toObjectId(input.afterId);
	const after = afterKey
		? await CollectionNodeModel.findOne(
				{ ...siblings, _id: afterKey },
				{ order: 1 },
			)
				.session(session)
				.lean<{ order: string }>()
		: null;
	if (!after) {
		throw badRequest(
			"INVALID_POSITION",
			"afterId is not a sibling in this folder",
		);
	}
	const next = await CollectionNodeModel.findOne(
		{ ...siblings, order: { $gt: after.order } },
		{ order: 1 },
	)
		.session(session)
		.sort({ order: 1 })
		.lean<{ order: string }>();
	return orderKeyBetween(after.order, next?.order ?? null);
}

function newNode(input: NodeCreate, order: string): CollectionNode {
	const base = {
		id: new Types.ObjectId().toHexString(),
		parentId: input.parentId,
		order,
		name: input.name,
		description: "",
	};
	if (input.kind === "example") {
		const { request, response } = input;
		return {
			kind: "example",
			id: base.id,
			parentId: input.parentId,
			order,
			name: input.name,
			request,
			response,
		};
	}
	if (input.kind === "request") {
		return { kind: "request", ...base, draft: input.draft };
	}
	const auth = { type: "inherit" } as const;
	return { kind: "folder", ...base, auth, scripts: { pre: "", post: "" } };
}

/**
 * Adds a folder, request or example (Editor), under the workspace lock so the node
 * count, the parent checks and the collection's byte budget hold when it
 * is written.
 */
export async function createNode(
	sub: string,
	id: string,
	input: NodeCreate,
): Promise<CollectionNode> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const nodeId = await inWorkspaceTransaction(
		element.workspaceId,
		async (session) => {
			const outline = await loadOutline(collectionId, session);
			if (outline.size >= COLLECTION_NODES_MAX) {
				throw nodesLimitReached(outline.size);
			}
			assertParent(outline, input.parentId, input.kind);
			const depth = folderDepth(outline, input.parentId) + 1;
			if (input.kind === "folder" && depth > COLLECTION_DEPTH_MAX) {
				throw tooDeep();
			}
			const node = newNode(input, await newOrder(collectionId, input, session));
			assertNodeSize(node);
			await chargeRoot(collectionId, sub, session, {
				bytes: nodeBytes(node),
				requests: node.kind === "request" ? 1 : 0,
				revisions: [nodesRevision("create", node, [], [node])],
			});
			await CollectionNodeModel.create(
				[storedNodeOf(node, collectionId, sub)],
				{ session },
			);
			return node.id;
		},
	);
	return toCollectionNode(await findNode(collectionId, nodeId));
}
