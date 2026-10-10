import type { ClientSession, Types } from "mongoose";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import { WorkspaceModel } from "./workspace-model.js";

/**
 * When the owner of a team workspace leaves or is removed, the oldest
 * remaining Admin becomes its owner. The owner's plan bounds the members
 * and counts the workspace among their team workspaces, so it must follow
 * someone who still belongs to it. Runs under the workspace lock, after
 * the member row is deleted; the last-Admin rule guarantees an Admin.
 *
 * The hand-over happens even when the heir already owns as many team
 * workspaces as their plan allows (Jev's decision: a workspace never loses
 * its owner over a quota). The heir may then be over their
 * `teamWorkspaces` limit; that only blocks them from creating new team
 * workspaces until they are back under it. From then on the heir's plan
 * bounds the seats: existing members stay even past it, and new
 * invitations and acceptances must pass the seat check against it.
 */
export async function handOverOwnership(
	workspaceId: Types.ObjectId,
	leavingSub: string,
	session: ClientSession,
): Promise<void> {
	const owned = await WorkspaceModel.exists({
		_id: workspaceId,
		ownerId: leavingSub,
	}).session(session);
	if (!owned) return;
	const heir = await WorkspaceMemberModel.findOne({
		workspaceId,
		status: "accepted",
		role: "admin",
	})
		.sort({ acceptedAt: 1, createdAt: 1, _id: 1 })
		.session(session)
		.lean<StoredWorkspaceMember>();
	if (!heir?.userId) return;
	await WorkspaceModel.updateOne(
		{ _id: workspaceId },
		{ $set: { ownerId: heir.userId } },
		{ session },
	);
}
