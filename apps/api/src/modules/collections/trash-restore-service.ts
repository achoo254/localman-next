import { OperationError } from "@localman/operations";
import {
	WORKSPACE_PERMISSIONS,
	workspaceRoleAllows,
} from "@localman/shared/access";
import type { CollectionDetail } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { CollectionModel } from "./collection-model.js";
import {
	assertWorkspaceRoom,
	loadCollectionDetail,
} from "./collection-store.js";
import { rootRevision } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import {
	IN_TRASH,
	type TrashedCollection,
	notInTrash,
	requireTrashed,
} from "./trash-access.js";

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
		const revision = rootRevision(
			"untrash",
			trashed._id.toHexString(),
			trashed.name,
			null,
			null,
		);
		await chargeRoot(trashed._id, sub, session, { revisions: [revision] });
	});
	// The caller adds elements to the target: an Editor of what lands there.
	return loadCollectionDetail(trashed._id, "editor");
}
