import { OperationError } from "@localman/operations";
import type { WorkspaceRole } from "@localman/shared/access";
import type { ClientSession } from "mongoose";
import { displayNameOf } from "../access/display-name.js";
import { takeInviteLookupSlot } from "../collaborators/invite-rate-limits.js";
import {
	INVITE_TTL_MS,
	issueInviteToken,
} from "../collaborators/invite-token.js";
import { resolveInviteTarget } from "../collaborators/invitee-lookup.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import {
	alreadyWorkspaceMember,
	storeAddressed,
} from "./workspace-invite-store.js";
import { inWorkspaceTransaction } from "./workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import type { StoredWorkspace } from "./workspace-model.js";
import { assertWorkspaceSeats } from "./workspace-seats.js";
import { assertTeamWorkspace } from "./workspace-service.js";

export interface IssuedWorkspaceInvite {
	readonly row: StoredWorkspaceMember;
	/** `/workspace-invite/:token`; returned once, never stored. */
	readonly inviteLink: string;
	/** Whether the invited account was notified. */
	readonly notified: boolean;
}

/** Web page of a workspace invitation; it previews and accepts the token. */
export function workspaceInviteLinkOf(token: string): string {
	return `/workspace-invite/${token}`;
}

function isMember(
	workspace: StoredWorkspace,
	sub: string,
	session: ClientSession | null = null,
): Promise<unknown> {
	return WorkspaceMemberModel.exists({
		workspaceId: workspace._id,
		userId: sub,
		status: "accepted",
	}).session(session);
}

/**
 * Invites the person `typed` names (username or email) with `role`. A
 * matching account is bound and notified (in-app, Web Push, Telegram as it
 * chose) with the link; an email without an account gets a link the Admin
 * sends themselves, which only an account whose IdP verified that email
 * can accept (`addresseeProblem`).
 */
export async function inviteToWorkspace(
	workspace: StoredWorkspace,
	inviterSub: string,
	typed: string,
	role: WorkspaceRole,
): Promise<IssuedWorkspaceInvite> {
	assertTeamWorkspace(workspace);
	await takeInviteLookupSlot(inviterSub);
	const target = await resolveInviteTarget(typed);
	if (!target) {
		throw new OperationError(
			404,
			"INVITEE_NOT_FOUND",
			"No account has this username; invite them by email instead",
		);
	}
	if (target.kind === "account") {
		if (target.account.sub === inviterSub) {
			throw new OperationError(
				400,
				"CANNOT_INVITE_SELF",
				"You are a member of this workspace already",
			);
		}
		if (await isMember(workspace, target.account.sub)) {
			throw alreadyWorkspaceMember();
		}
	}
	const inviter = await displayNameOf(inviterSub);
	const notifications = getNotificationService();
	const issued = issueInviteToken();
	const row = await storeAddressed(workspace, target, {
		role,
		status: "pending",
		inviteTokenHash: issued.tokenHash,
		expiresAt: issued.expiresAt,
		invitedBy: inviterSub,
	});
	const inviteLink = workspaceInviteLinkOf(issued.token);
	if (target.kind === "account") {
		// Never throws: the invitation is stored and its link shown only now.
		notifications.notifyLater(target.account.sub, {
			type: "workspace.invitation",
			params: {
				inviter,
				workspace: workspace.name,
				role,
				days: INVITE_TTL_MS / (24 * 60 * 60 * 1000),
			},
			link: inviteLink,
		});
	}
	return { row, inviteLink, notified: target.kind === "account" };
}

/**
 * A one-use link that admits the first signed-in person who accepts it,
 * with `role`. It holds a seat until it is used or expires.
 */
export async function createInviteLink(
	workspace: StoredWorkspace,
	inviterSub: string,
	role: WorkspaceRole,
): Promise<IssuedWorkspaceInvite> {
	assertTeamWorkspace(workspace);
	const issued = issueInviteToken();
	const row = await inWorkspaceTransaction(workspace._id, async (session) => {
		await assertWorkspaceSeats(workspace, session, 1);
		const [created] = await WorkspaceMemberModel.create(
			[
				{
					workspaceId: workspace._id,
					role,
					status: "pending",
					inviteTokenHash: issued.tokenHash,
					expiresAt: issued.expiresAt,
					invitedBy: inviterSub,
				},
			],
			{ session },
		);
		if (!created) throw new Error("Invite link was not created");
		return created.toObject<StoredWorkspaceMember>();
	});
	return {
		row,
		inviteLink: workspaceInviteLinkOf(issued.token),
		notified: false,
	};
}

/** Cancels a pending invitation (addressed or link); it frees its seat. */
export async function revokeInvitation(
	workspace: StoredWorkspace,
	invitationId: string,
	dryRun: boolean,
): Promise<StoredWorkspaceMember> {
	const row = /^[a-f\d]{24}$/i.test(invitationId)
		? await WorkspaceMemberModel.findOne({
				_id: invitationId,
				workspaceId: workspace._id,
				status: "pending",
			}).lean<StoredWorkspaceMember>()
		: null;
	if (!row) throw new OperationError(404, "NOT_FOUND", "Invitation not found");
	if (!dryRun) {
		await WorkspaceMemberModel.deleteOne({ _id: row._id, status: "pending" });
	}
	return row;
}
