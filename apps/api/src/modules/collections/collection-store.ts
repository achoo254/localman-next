import { OperationError } from "@localman/operations";
import type { ElementRole } from "@localman/shared/access";
import {
	type ApiRequestDraft,
	COLLECTION_NODES_MAX,
	type CollectionDetail,
	type CollectionNode,
	type CollectionRootFields,
	EXAMPLE_BODY_MAX,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import {
	DRAFT_MAX_BYTES,
	draftBytes,
	draftTooLarge,
} from "../api-client/draft-size.js";
import type { NodePayload } from "./collection-bytes.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "./collection-model.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import { toCollectionDetail } from "./collection-view.js";
import { displayNames } from "./people.js";
import { foldSearchText } from "./search-text.js";

/**
 * Live collections one workspace may hold, so its sidebar list is one
 * bounded query. Checked under the workspace lock wherever a collection
 * lands in a workspace (create, duplicate, restore).
 */
export const COLLECTIONS_PER_WORKSPACE_MAX = 1_000;

export const newNodeId = (): string => new Types.ObjectId().toHexString();

export function nodesLimitReached(count: number): OperationError {
	return new OperationError(
		409,
		"COLLECTION_NODES_LIMIT",
		`A collection holds at most ${COLLECTION_NODES_MAX} folders and requests`,
		{ max: COLLECTION_NODES_MAX, count },
	);
}

/** 413 `DRAFT_TOO_LARGE` for a request above the saved-draft cap. */
export function assertDraftSize(draft: ApiRequestDraft): void {
	const bytes = draftBytes(draft);
	if (bytes > DRAFT_MAX_BYTES) throw draftTooLarge(bytes, DRAFT_MAX_BYTES);
}

export async function findLiveCollection(
	collectionId: Types.ObjectId,
): Promise<StoredCollection | null> {
	return CollectionModel.findOne({
		_id: collectionId,
		...LIVE_COLLECTION,
	}).lean<StoredCollection>();
}

/**
 * Every node of the collection (at most `COLLECTION_NODES_MAX`), in the
 * order of the `{ collectionId, parentId, order }` index; readers that
 * need a total order sort with `compareOrder`.
 */
export async function findNodes(
	collectionId: Types.ObjectId,
): Promise<StoredCollectionNode[]> {
	return CollectionNodeModel.find({ collectionId })
		.sort({ parentId: 1, order: 1 })
		.limit(COLLECTION_NODES_MAX)
		.lean<StoredCollectionNode[]>();
}

/**
 * The live collection with its nodes, as seen by a caller holding `role`
 * on it; 404 once it is gone or trashed.
 */
export async function loadCollectionDetail(
	collectionId: Types.ObjectId,
	role: ElementRole,
): Promise<CollectionDetail> {
	const root = await findLiveCollection(collectionId);
	if (!root) throw elementNotFound();
	const [nodes, names] = await Promise.all([
		findNodes(collectionId),
		displayNames([root.createdBy, root.updatedBy]),
	]);
	return toCollectionDetail(root, nodes, role, names);
}

/** 409 `COLLECTION_LIMIT_REACHED` when the workspace is full. */
export async function assertWorkspaceRoom(
	workspaceId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	const count = await CollectionModel.countDocuments({
		workspaceId,
		...LIVE_COLLECTION,
	}).session(session);
	if (count >= COLLECTIONS_PER_WORKSPACE_MAX) {
		throw new OperationError(
			409,
			"COLLECTION_LIMIT_REACHED",
			`A workspace holds at most ${COLLECTIONS_PER_WORKSPACE_MAX} collections`,
			{ max: COLLECTIONS_PER_WORKSPACE_MAX },
		);
	}
}

/**
 * The stored form of a node; its ids must be 24 hex digits. Examples are
 * left out of search (no `searchName`): they show under their request.
 */
export function storedNodeOf(
	node: CollectionNode,
	collectionId: Types.ObjectId,
	sub: string,
): Record<string, unknown> {
	const base = {
		_id: new Types.ObjectId(node.id),
		collectionId,
		parentId: node.parentId === null ? null : new Types.ObjectId(node.parentId),
		kind: node.kind,
		order: node.order,
		name: node.name,
		updatedBy: sub,
	};
	if (node.kind === "example") {
		return { ...base, request: node.request, response: node.response };
	}
	const searchable = {
		...base,
		searchName: foldSearchText(node.name),
		description: node.description,
	};
	return node.kind === "request"
		? { ...searchable, draft: node.draft }
		: { ...searchable, auth: node.auth, scripts: node.scripts };
}

/**
 * 413 `DRAFT_TOO_LARGE` for a request draft (of a request or an example)
 * above the saved-draft cap. Example bodies are bounded by their schema
 * (`EXAMPLE_BODY_MAX` bytes, 400 otherwise).
 */
export function assertNodeSize(node: NodePayload): void {
	if (node.kind === "request") assertDraftSize(node.draft);
	if (node.kind === "example") assertDraftSize(node.request);
}
