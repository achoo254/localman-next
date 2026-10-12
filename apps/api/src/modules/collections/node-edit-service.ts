import { OperationError } from "@localman/operations";
import type {
	CollectionNode,
	nodeUpdateSchema,
} from "@localman/shared/api-client";
import type { z } from "zod";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { nodeBytes } from "./collection-bytes.js";
import {
	CollectionNodeModel,
	type StoredCollectionNode,
} from "./collection-node-model.js";
import { assertNodeSize } from "./collection-store.js";
import { toCollectionNode } from "./collection-view.js";
import { findNode, nodeNotFound } from "./node-service.js";
import { nodesRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

export type NodeUpdate = z.infer<typeof nodeUpdateSchema>;
type UpdateField = keyof NodeUpdate;

/** What each kind of node may change. */
const FIELDS: Record<CollectionNode["kind"], readonly UpdateField[]> = {
	folder: ["name", "description", "auth", "scripts"],
	request: ["name", "description", "draft"],
	example: ["name", "request", "response"],
};

const UPDATE_FIELDS: readonly UpdateField[] = [
	"name",
	"description",
	"auth",
	"scripts",
	"draft",
	"request",
	"response",
];

/** The node once `update` is applied (fields of its kind only). */
function updatedNode(node: CollectionNode, update: NodeUpdate): CollectionNode {
	const name = update.name ?? node.name;
	if (node.kind === "example") {
		const request = update.request ?? node.request;
		return {
			...node,
			name,
			request,
			response: update.response ?? node.response,
		};
	}
	const description = update.description ?? node.description;
	if (node.kind === "request") {
		return { ...node, name, description, draft: update.draft ?? node.draft };
	}
	const auth = update.auth ?? node.auth;
	return {
		...node,
		name,
		description,
		auth,
		scripts: update.scripts ?? node.scripts,
	};
}

/** 400 `INVALID_NODE_FIELDS` for a field of another kind. */
function assertFields(kind: CollectionNode["kind"], update: NodeUpdate): void {
	const sent = UPDATE_FIELDS.filter(
		(key) => update[key] !== undefined && !FIELDS[kind].includes(key),
	);
	if (sent.length > 0) {
		throw new OperationError(
			400,
			"INVALID_NODE_FIELDS",
			`A ${kind} has no ${sent.join(", ")}`,
			{ fields: sent.join(",") },
		);
	}
}

/**
 * Edits a node's own fields (Editor): a folder its name, description,
 * auth and scripts, a request its name, description and draft, an
 * example its name, request and response. Runs under the workspace lock
 * with the collection's byte budget and a changelog entry.
 */
export async function updateNode(
	sub: string,
	id: string,
	nodeId: string,
	update: NodeUpdate,
): Promise<CollectionNode> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const _id = (await findNode(collectionId, nodeId))._id;
	await inWorkspaceTransaction(element.workspaceId, async (session) => {
		const stored = await CollectionNodeModel.findOne({ _id, collectionId })
			.session(session)
			.lean<StoredCollectionNode>();
		if (!stored) throw nodeNotFound();
		const before = toCollectionNode(stored);
		assertFields(before.kind, update);
		const after = updatedNode(before, update);
		assertNodeSize(after);
		const $set: Record<string, unknown> = { updatedBy: sub };
		for (const key of FIELDS[before.kind]) {
			if (update[key] !== undefined) $set[key] = update[key];
		}
		if (update.name !== undefined) {
			$set.searchName = foldSearchText(update.name);
		}
		await chargeRoot(collectionId, sub, session, {
			bytes: nodeBytes(after) - nodeBytes(before),
			revisions: [nodesRevision("update", after, [before], [after])],
		});
		await CollectionNodeModel.updateOne({ _id }, { $set }, { session });
	});
	return toCollectionNode(await findNode(collectionId, nodeId));
}
