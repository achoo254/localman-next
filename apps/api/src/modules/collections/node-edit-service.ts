import { OperationError } from "@localman/operations";
import type {
	CollectionNode,
	nodeUpdateSchema,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import type { z } from "zod";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { type NodePayload, chargeRoot, nodeBytes } from "./collection-bytes.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import { assertDraftSize } from "./collection-store.js";
import { toCollectionNode } from "./collection-view.js";
import { countKinds, loadOutline, subtreeIds } from "./node-outline.js";
import { findNode, nodeNotFound } from "./node-service.js";
import { foldSearchText } from "./search-text.js";

export type NodeUpdate = z.infer<typeof nodeUpdateSchema>;

const FOLDER_ONLY = ["auth", "scripts"] as const;
const REQUEST_ONLY = ["draft"] as const;

/** The node's content once `update` is applied. */
function updatedPayload(
	node: StoredCollectionNode,
	update: NodeUpdate,
): NodePayload {
	const name = update.name ?? node.name;
	const description = update.description ?? node.description;
	if (node.kind === "request") {
		return {
			kind: "request",
			name,
			description,
			draft: update.draft ?? node.draft,
		};
	}
	const auth = update.auth ?? node.auth;
	return {
		kind: "folder",
		name,
		description,
		auth,
		scripts: update.scripts ?? node.scripts,
	};
}

/**
 * Edits a node's own fields (Editor). A folder takes `auth` and `scripts`,
 * a request its `draft`; a field of the other kind answers 400. Runs under
 * the workspace lock with the byte budget of the collection.
 */
export async function updateNode(
	sub: string,
	id: string,
	nodeId: string,
	update: NodeUpdate,
): Promise<CollectionNode> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const kind = (await findNode(collectionId, nodeId)).kind;
	const foreign = kind === "folder" ? REQUEST_ONLY : FOLDER_ONLY;
	const sent = foreign.filter((key) => update[key] !== undefined);
	if (sent.length > 0) {
		throw new OperationError(
			400,
			"INVALID_NODE_FIELDS",
			`A ${kind} has no ${sent.join(", ")}`,
			{ fields: sent.join(",") },
		);
	}
	if (update.draft) assertDraftSize(update.draft);
	const $set: Record<string, unknown> = { updatedBy: sub };
	for (const [key, value] of Object.entries(update)) {
		if (value !== undefined) $set[key] = value;
	}
	if (update.name !== undefined) $set.searchName = foldSearchText(update.name);
	await inWorkspaceTransaction(element.workspaceId, async (session) => {
		const node = await CollectionNodeModel.findOne({
			_id: toNodeId(nodeId),
			collectionId,
		})
			.session(session)
			.lean<StoredCollectionNode>();
		if (!node) throw nodeNotFound();
		const bytes = nodeBytes(updatedPayload(node, update)) - nodeBytes(node);
		await chargeRoot(collectionId, sub, session, { bytes });
		await CollectionNodeModel.updateOne(
			{ _id: node._id },
			{ $set },
			{ session },
		);
	});
	return toCollectionNode(await findNode(collectionId, nodeId));
}

/** `findNode` already accepted the id, so it is 24 hex digits. */
const toNodeId = (nodeId: string) => new Types.ObjectId(nodeId);

export interface NodeDeletion {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	readonly nodeId: string;
	readonly folders: number;
	readonly requests: number;
}

/** Deletes a node with everything under it (Editor); dry run counts them. */
export async function deleteNode(
	sub: string,
	id: string,
	nodeId: string,
	dryRun: boolean,
): Promise<NodeDeletion> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const node = await findNode(collectionId, nodeId);
	const selfId = node._id.toHexString();
	const counts = await inWorkspaceTransaction(
		element.workspaceId,
		async (session) => {
			const outline = await loadOutline(collectionId, session);
			if (!outline.has(selfId)) throw nodeNotFound();
			const ids = subtreeIds(outline, selfId).map(
				(at) => new Types.ObjectId(at),
			);
			const counts = countKinds(
				outline,
				ids.map((at) => at.toHexString()),
			);
			if (dryRun) return counts;
			const gone = await CollectionNodeModel.find({
				collectionId,
				_id: { $in: ids },
			})
				.session(session)
				.lean<StoredCollectionNode[]>();
			const bytes = gone.reduce((sum, at) => sum + nodeBytes(at), 0);
			await chargeRoot(collectionId, sub, session, {
				bytes: -bytes,
				requests: -counts.requests,
			});
			await CollectionNodeModel.deleteMany(
				{ collectionId, _id: { $in: ids } },
				{ session },
			);
			return counts;
		},
	);
	return { dryRun, deleted: !dryRun, nodeId, ...counts };
}
