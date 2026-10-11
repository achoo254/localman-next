import { OperationError } from "@localman/operations";
import type { ElementRole } from "@localman/shared/access";
import {
	type ApiRequestDraft,
	COLLECTION_NODES_MAX,
	type CollectionDetail,
	type CollectionNode,
	type CollectionRootFields,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import {
	DRAFT_MAX_BYTES,
	draftBytes,
	draftTooLarge,
} from "../api-client/draft-size.js";
import {
	COLLECTION_BYTES_MAX,
	collectionTooLarge,
	nodeBytes,
	rootBytes,
} from "./collection-bytes.js";
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
	return toCollectionDetail(root, await findNodes(collectionId), role);
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

/** The stored form of a node; its ids must be 24 hex digits. */
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
		searchName: foldSearchText(node.name),
		description: node.description,
		updatedBy: sub,
	};
	return node.kind === "request"
		? { ...base, draft: node.draft }
		: { ...base, auth: node.auth, scripts: node.scripts };
}

export interface NewCollection {
	readonly workspaceId: Types.ObjectId;
	readonly root: CollectionRootFields;
	/** Ids from `newNodeId`, parents listed before their children or not. */
	readonly nodes: readonly CollectionNode[];
	readonly sub: string;
}

/**
 * Writes a new collection and its nodes in the caller's transaction
 * (which holds the target workspace's lock). Returns its id.
 */
export async function insertCollection(
	input: NewCollection,
	session: ClientSession,
): Promise<Types.ObjectId> {
	if (input.nodes.length > COLLECTION_NODES_MAX) {
		throw nodesLimitReached(input.nodes.length);
	}
	let bytes = rootBytes(input.root);
	for (const node of input.nodes) bytes += nodeBytes(node);
	if (bytes > COLLECTION_BYTES_MAX) throw collectionTooLarge(bytes);
	const requestCount = input.nodes.filter((n) => n.kind === "request").length;
	await assertWorkspaceRoom(input.workspaceId, session);
	const _id = new Types.ObjectId();
	await CollectionModel.create(
		[
			{
				_id,
				workspaceId: input.workspaceId,
				...input.root,
				bytes,
				requestCount,
				createdBy: input.sub,
				updatedBy: input.sub,
			},
		],
		{ session },
	);
	if (input.nodes.length > 0) {
		await CollectionNodeModel.insertMany(
			input.nodes.map((node) => storedNodeOf(node, _id, input.sub)),
			{ session },
		);
	}
	return _id;
}
