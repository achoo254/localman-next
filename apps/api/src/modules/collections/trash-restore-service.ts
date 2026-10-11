import { OperationError } from "@localman/operations";
import {
	WORKSPACE_PERMISSIONS,
	workspaceRoleAllows,
} from "@localman/shared/access";
import type { CollectionDetail } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel } from "./collection-model.js";
import {
	assertWorkspaceRoom,
	loadCollectionDetail,
} from "./collection-store.js";
import {
	IN_TRASH,
	type TrashedCollection,
	notInTrash,
	requireTrashed,
} from "./trash-access.js";
import { type TrashedView, toTrashedViews } from "./trash-view.js";

/** Trashed collections one listing returns, newest first. */
export const TRASH_LIST_MAX = 500;

/** Workspaces where `sub` restores now: their own and those they edit. */
async function managedWorkspaceIds(sub: string): Promise<Types.ObjectId[]> {
	const [personal, memberships] = await Promise.all([
		WorkspaceModel.find({ ownerId: sub, type: "personal" }, { _id: 1 }).lean<
			{ _id: Types.ObjectId }[]
		>(),
		WorkspaceMemberModel.find(
			{
				userId: sub,
				status: "accepted",
				role: { $in: [...WORKSPACE_PERMISSIONS.restoreElements] },
			},
			{ workspaceId: 1 },
		).lean<{ workspaceId: Types.ObjectId }[]>(),
	]);
	return [
		...personal.map((row) => row._id),
		...memberships.map((row) => row.workspaceId),
	];
}

/**
 * The trash `sub` may restore from, as `requireTrashed` decides: deleted
 * collections of workspaces where they are Admin or Editor now, and of
 * deleted workspaces where they were (`trashEditors`) or that they
 * deleted the collection from. `workspaceId` narrows it to one original
 * workspace.
 */
export async function listTrash(
	sub: string,
	workspaceId: string | undefined,
): Promise<TrashedView[]> {
	const narrowTo =
		workspaceId === undefined ? undefined : toObjectId(workspaceId);
	if (narrowTo === null) return [];
	const rows = await CollectionModel.find({
		...IN_TRASH,
		...(narrowTo ? { workspaceId: narrowTo } : {}),
		$or: [
			{ workspaceId: { $in: await managedWorkspaceIds(sub) } },
			// `trashEditors` is only set once the workspace is deleted.
			{ trashEditors: sub },
			{ deletedBy: sub, trashEditors: { $exists: true } },
		],
	})
		.sort({ deletedAt: -1, _id: -1 })
		.limit(TRASH_LIST_MAX)
		.lean<TrashedCollection[]>();
	return toTrashedViews(rows);
}

function teamToPersonal(): OperationError {
	return new OperationError(
		409,
		"TEAM_TO_PERSONAL",
		"A team collection cannot be restored into a personal workspace",
	);
}

/**
 * Restores a trashed collection into a workspace where the caller adds
 * elements. Into its original workspace, the right to restore suffices;
 * elsewhere it is a move too (phase 11 rule): moving elements out of the
 * original workspace, never from a team workspace to a personal one. With
 * the original workspace deleted, any team workspace will do.
 */
export async function restoreCollection(
	sub: string,
	id: string,
	targetWorkspaceId: string,
): Promise<CollectionDetail> {
	const { trashed, original, originalRole } = await requireTrashed(sub, id);
	const { workspace: target } = await requireWorkspace(
		sub,
		"addElements",
		targetWorkspaceId,
	);
	if (!original) {
		if (target.type === "personal") throw teamToPersonal();
	} else if (!target._id.equals(original._id)) {
		if (!workspaceRoleAllows(originalRole, "moveDeleteElements")) {
			throw new OperationError(
				403,
				"FORBIDDEN",
				"Only Admins and Editors of its workspace can move this collection",
			);
		}
		if (original.type === "team" && target.type === "personal") {
			throw teamToPersonal();
		}
	}
	await inWorkspaceTransaction(target._id, async (session) => {
		await assertWorkspaceRoom(target._id, session);
		const result = await CollectionModel.updateOne(
			{ _id: trashed._id, ...IN_TRASH },
			{
				$set: { workspaceId: target._id, updatedBy: sub },
				$unset: { deletedAt: 1, deletedBy: 1, trashEditors: 1 },
			},
			{ session },
		);
		if (result.matchedCount === 0) throw notInTrash();
	});
	// The caller adds elements to the target: an Editor of what lands there.
	return loadCollectionDetail(trashed._id, "editor");
}
