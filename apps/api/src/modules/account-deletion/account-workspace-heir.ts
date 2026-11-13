import { WORKSPACE_ROLES } from "@localman/shared/access";
import type { Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "../workspaces/workspace-member-model.js";

/** Lower is higher: `WORKSPACE_ROLES` lists Admin first. */
function rankOf(member: StoredWorkspaceMember): number {
	return WORKSPACE_ROLES.indexOf(member.role);
}

function joinedAt(member: StoredWorkspaceMember): number {
	return (member.acceptedAt ?? member.createdAt).getTime();
}

/** Highest role first, then the earliest to join, then the oldest row. */
function byInheritance(
	a: StoredWorkspaceMember,
	b: StoredWorkspaceMember,
): number {
	return (
		rankOf(a) - rankOf(b) ||
		joinedAt(a) - joinedAt(b) ||
		a._id.toHexString().localeCompare(b._id.toHexString())
	);
}

/**
 * Makes sure a team workspace keeps an Admin when the deleted account
 * leaves it (the owner's decision for deletions made at the IdP: shared
 * assets move to someone else instead of blocking the deletion). Where no
 * other accepted member is Admin, the remaining member with the highest
 * role, then the earliest to join, becomes Admin; the hand-over of
 * ownership on leaving then picks them. Runs under the workspace lock, so
 * a concurrent demotion cannot leave the workspace without an Admin.
 */
export async function promoteHeir(
	workspaceId: Types.ObjectId,
	leavingSub: string,
): Promise<void> {
	await inWorkspaceTransaction(workspaceId, async (session) => {
		const others = await WorkspaceMemberModel.find({
			workspaceId,
			status: "accepted",
			userId: { $exists: true, $ne: leavingSub },
		})
			.session(session)
			.lean<StoredWorkspaceMember[]>();
		if (others.some((member) => member.role === "admin")) return;
		const [heir] = [...others].sort(byInheritance);
		if (!heir) return;
		await WorkspaceMemberModel.updateOne(
			{ _id: heir._id },
			{ $set: { role: "admin" } },
			{ session },
		);
	});
}
