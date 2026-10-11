import { OperationError } from "@localman/operations";
import {
	WORKSPACE_PERMISSIONS,
	workspaceRoleAllows,
} from "@localman/shared/access";
import {
	type CollectionDetail,
	DELETE_CONFIRMATION,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import { workspaceMissing } from "../access/share-service.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import {
	findWorkspaceById,
	requireWorkspace,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	assertWorkspaceRoom,
	loadCollectionDetail,
} from "./collection-store.js";
import {
	IN_TRASH,
	type TrashedCollection,
	notInTrash,
	purgeAtOf,
	requireTrashed,
} from "./trash-access.js";
import { type TrashedView, toTrashedViews } from "./trash-view.js";

export interface CollectionTrashing {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	readonly collectionId: string;
	readonly name: string;
	readonly folders: number;
	readonly requests: number;
	/** When the job deletes it for good, once trashed. */
	readonly purgeAt: string;
}

/**
 * Moves a collection to the trash: Editor on it and Admin or Editor of
 * its workspace (a share alone does not let anyone throw the team's
 * collection away). One holding requests needs `confirm: "delete"`.
 */
export async function trashCollection(
	sub: string,
	id: string,
	confirm: string | undefined,
	dryRun: boolean,
): Promise<CollectionTrashing> {
	const { element, collectionId } = await requireCollection(sub, id, "edit");
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	if (!workspace) throw workspaceMissing();
	if (
		!workspaceRoleAllows(
			await workspaceRoleOf(sub, workspace),
			"moveDeleteElements",
		)
	) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Admins and Editors of its workspace can delete this collection",
		);
	}
	const [requests, folders] = await Promise.all([
		CollectionNodeModel.countDocuments({ collectionId, kind: "request" }),
		CollectionNodeModel.countDocuments({ collectionId, kind: "folder" }),
	]);
	const now = new Date();
	const result = {
		dryRun,
		deleted: !dryRun,
		collectionId: element.id,
		name: element.name,
		folders,
		requests,
		purgeAt: purgeAtOf(now).toISOString(),
	};
	if (dryRun) return result;
	if (requests > 0 && confirm !== DELETE_CONFIRMATION) {
		throw new OperationError(
			400,
			"CONFIRMATION_REQUIRED",
			`This collection holds requests: send confirm "${DELETE_CONFIRMATION}" to delete it`,
		);
	}
	const update = await CollectionModel.updateOne(
		{ _id: collectionId, ...LIVE_COLLECTION },
		{ $set: { deletedAt: now, deletedBy: sub } },
	);
	if (update.matchedCount === 0) throw elementNotFound();
	return result;
}
