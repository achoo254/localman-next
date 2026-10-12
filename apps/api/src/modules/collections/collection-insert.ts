import type {
	CollectionNode,
	CollectionRootFields,
} from "@localman/shared/api-client";
import { COLLECTION_NODES_MAX } from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import {
	COLLECTION_BYTES_MAX,
	collectionTooLarge,
	nodeBytes,
	rootBytes,
} from "./collection-bytes.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	assertNodeSize,
	assertWorkspaceRoom,
	nodesLimitReached,
	storedNodeOf,
} from "./collection-store.js";
import { rootRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

export interface NewCollection {
	readonly workspaceId: Types.ObjectId;
	readonly root: CollectionRootFields;
	/** Ids from `newNodeId`, parents listed before their children or not. */
	readonly nodes: readonly CollectionNode[];
	readonly sub: string;
	/** The mock project it comes from, already checked readable. */
	readonly mockProjectId?: Types.ObjectId;
	/** The environment linked to it (`null`: none chosen), same workspace. */
	readonly linkedEnvironmentId?: Types.ObjectId | null;
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
	for (const node of input.nodes) assertNodeSize(node);
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
				searchName: foldSearchText(input.root.name),
				bytes,
				requestCount,
				createdBy: input.sub,
				updatedBy: input.sub,
				...(input.mockProjectId ? { mockProjectId: input.mockProjectId } : {}),
				...(input.linkedEnvironmentId === undefined
					? {}
					: { linkedEnvironmentId: input.linkedEnvironmentId }),
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
	// The changelog starts here; its first entry records the root only.
	const created = rootRevision(
		"create",
		_id.toHexString(),
		input.root.name,
		null,
		input.root,
	);
	await chargeRoot(_id, input.sub, session, { revisions: [created] });
	return _id;
}
