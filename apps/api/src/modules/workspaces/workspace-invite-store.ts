import { OperationError } from "@localman/operations";
import type { WorkspaceRole } from "@localman/shared/access";
import type { InviteTarget } from "../collaborators/invitee-lookup.js";
import { inWorkspaceTransaction } from "./workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import type { StoredWorkspace } from "./workspace-model.js";
import { assertWorkspaceSeats, holdsSeat } from "./workspace-seats.js";

export const alreadyWorkspaceMember = (): OperationError =>
	new OperationError(
		409,
		"ALREADY_MEMBER",
		"This person is already a member of the workspace",
	);

/** Identity fields of an invitation, rebuilt from the target every time. */
function identityOf(target: InviteTarget): {
	$set: Record<string, string>;
	$unset: Record<string, 1>;
} {
	const $set: Record<string, string> = {};
	const $unset: Record<string, 1> = {};
	if (target.kind === "account") $set.userId = target.account.sub;
	else $unset.userId = 1;
	if (target.email === null) $unset.email = 1;
	else $set.email = target.email;
	return { $set, $unset };
}

export interface InvitationFields {
	readonly role: WorkspaceRole;
	readonly status: "pending";
	readonly inviteTokenHash: string;
	readonly expiresAt: Date;
	readonly invitedBy: string;
}

/**
 * Stores the invitation under the workspace lock: refuses the target's
 * membership, re-issues (new token, expiry and role, same seat) the oldest
 * pending invitation of the same person or address, drops the others, and
 * otherwise takes a free seat of the owner's plan.
 */
export function storeAddressed(
	workspace: StoredWorkspace,
	target: InviteTarget,
	fields: InvitationFields,
): Promise<StoredWorkspaceMember> {
	return inWorkspaceTransaction(workspace._id, async (session) => {
		const who: Record<string, string>[] = [];
		if (target.kind === "account") who.push({ userId: target.account.sub });
		if (target.email !== null) who.push({ email: target.email });
		const rows = await WorkspaceMemberModel.find({
			workspaceId: workspace._id,
			$or: who,
		})
			.sort({ createdAt: 1, _id: 1 })
			.session(session)
			.lean<StoredWorkspaceMember[]>();
		if (rows.some((row) => row.status === "accepted")) {
			throw alreadyWorkspaceMember();
		}
		const [reused, ...duplicates] = rows;
		if (duplicates.length > 0) {
			await WorkspaceMemberModel.deleteMany(
				{ _id: { $in: duplicates.map((row) => row._id) } },
				{ session },
			);
		}
		const now = new Date();
		await assertWorkspaceSeats(
			workspace,
			session,
			reused && holdsSeat(reused, now) ? 0 : 1,
		);
		const identity = identityOf(target);
		if (!reused) {
			const [created] = await WorkspaceMemberModel.create(
				[{ workspaceId: workspace._id, ...fields, ...identity.$set }],
				{ session },
			);
			if (!created) throw new Error("Invitation was not created");
			return created.toObject<StoredWorkspaceMember>();
		}
		const updated = await WorkspaceMemberModel.findOneAndUpdate(
			{ _id: reused._id },
			{
				$set: { ...fields, ...identity.$set },
				...(Object.keys(identity.$unset).length > 0
					? { $unset: identity.$unset }
					: {}),
			},
			{ session, returnDocument: "after" },
		).lean<StoredWorkspaceMember>();
		if (!updated) throw new Error("Invitation vanished under the lock");
		return updated;
	});
}
