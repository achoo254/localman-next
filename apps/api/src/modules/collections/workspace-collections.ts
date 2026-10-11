import { WORKSPACE_PERMISSIONS } from "@localman/shared/access";
import type { ClientSession, Types } from "mongoose";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";

/** Live collections of a workspace (what deleting it moves to the trash). */
export async function countLiveCollections(
	workspaceId: Types.ObjectId,
): Promise<number> {
	return CollectionModel.countDocuments({ workspaceId, ...LIVE_COLLECTION });
}

/**
 * Moves every live collection of a workspace being deleted to the trash,
 * in the deletion's transaction, as deleted by `sub`. Every collection of
 * it in the trash records the workspace's Admins and Editors of this
 * moment (`trashEditors`): with the workspace gone, they and whoever
 * deleted a collection may still restore it into another workspace.
 */
export async function trashWorkspaceCollections(
	workspaceId: Types.ObjectId,
	sub: string,
	session: ClientSession,
): Promise<number> {
	const editors = await WorkspaceMemberModel.find(
		{
			workspaceId,
			status: "accepted",
			role: { $in: [...WORKSPACE_PERMISSIONS.restoreElements] },
		},
		{ userId: 1 },
	)
		.session(session)
		.lean<{ userId: string }[]>();
	const trashEditors = editors.map((row) => row.userId);
	const trashed = await CollectionModel.updateMany(
		{ workspaceId, ...LIVE_COLLECTION },
		{ $set: { deletedAt: new Date(), deletedBy: sub, trashEditors } },
		{ session },
	);
	await CollectionModel.updateMany(
		{ workspaceId, deletedAt: { $exists: true } },
		{ $set: { trashEditors } },
		{ session },
	);
	return trashed.modifiedCount;
}
