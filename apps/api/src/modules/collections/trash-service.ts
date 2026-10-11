import { OperationError } from "@localman/operations";
import { workspaceRoleAllows } from "@localman/shared/access";
import { DELETE_CONFIRMATION } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { workspaceMissing } from "../access/share-service.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { rootRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import { purgeAtOf } from "./trash-access.js";

export interface CollectionTrashing {
	readonly collectionId: string;
	readonly name: string;
	readonly folders: number;
	readonly requests: number;
	/** When the job deletes it for good, once trashed. */
	readonly purgeAt: string;
}

export interface Trashable extends CollectionTrashing {
	readonly element: ElementRecord;
	readonly objectId: Types.ObjectId;
}

/** The collection (Editor on it) with what it holds, ready to trash. */
export async function collectionToTrash(
	sub: string,
	id: string,
): Promise<Trashable> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const [requests, folders] = await Promise.all([
		CollectionNodeModel.countDocuments({ collectionId, kind: "request" }),
		CollectionNodeModel.countDocuments({ collectionId, kind: "folder" }),
	]);
	const purgeAt = purgeAtOf(new Date()).toISOString();
	const { name } = element;
	return {
		element,
		objectId: collectionId,
		collectionId: element.id,
		name,
		folders,
		requests,
		purgeAt,
	};
}

/**
 * The collection if `sub` may move it to the trash: Editor on it and
 * Admin or Editor of its workspace (a share alone does not let anyone
 * throw the team's collection away), with what it holds.
 */
export async function trashable(sub: string, id: string): Promise<Trashable> {
	const item = await collectionToTrash(sub, id);
	const workspace = await findWorkspaceById(
		item.element.workspaceId.toHexString(),
	);
	if (!workspace) throw workspaceMissing();
	const role = await workspaceRoleOf(sub, workspace);
	if (!workspaceRoleAllows(role, "moveDeleteElements")) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Admins and Editors of its workspace can delete this collection",
		);
	}
	return item;
}

/** 400 `CONFIRMATION_REQUIRED` unless "delete" was typed for requests. */
export function assertConfirmed(
	items: readonly CollectionTrashing[],
	confirm: string | undefined,
): void {
	if (confirm === DELETE_CONFIRMATION) return;
	if (items.every((item) => item.requests === 0)) return;
	throw new OperationError(
		400,
		"CONFIRMATION_REQUIRED",
		`Requests would go to the trash: send confirm "${DELETE_CONFIRMATION}"`,
	);
}

/** Trashes `items` in the caller's transaction, each with a changelog entry. */
export async function moveToTrash(
	items: readonly Trashable[],
	sub: string,
	session: ClientSession,
): Promise<void> {
	const deletedAt = new Date();
	for (const item of items) {
		const revision = rootRevision(
			"trash",
			item.collectionId,
			item.name,
			null,
			null,
		);
		await chargeRoot(item.objectId, sub, session, { revisions: [revision] });
		const result = await CollectionModel.updateOne(
			{ _id: item.objectId, ...LIVE_COLLECTION },
			{ $set: { deletedAt, deletedBy: sub } },
			{ session },
		);
		if (result.matchedCount === 0) throw elementNotFound();
	}
}

/** Strips the internals of a trashable collection for a response. */
export function trashingView(item: Trashable): CollectionTrashing {
	const { collectionId, name, folders, requests, purgeAt } = item;
	return { collectionId, name, folders, requests, purgeAt };
}

/**
 * Moves one collection to the trash under its workspace's lock; one
 * holding requests needs `confirm: "delete"`. A dry run only reports.
 */
export async function trashCollection(
	sub: string,
	id: string,
	confirm: string | undefined,
	dryRun: boolean,
): Promise<CollectionTrashing & { dryRun: boolean; deleted: boolean }> {
	const item = await trashable(sub, id);
	if (!dryRun) {
		assertConfirmed([item], confirm);
		await inWorkspaceTransaction(item.element.workspaceId, (session) =>
			moveToTrash([item], sub, session),
		);
	}
	return { dryRun, deleted: !dryRun, ...trashingView(item) };
}
