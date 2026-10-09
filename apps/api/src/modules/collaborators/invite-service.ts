import { OperationError } from "@localman/operations";
import { getNotificationService } from "../notifications/notification-runtime.js";
import type { NotificationService } from "../notifications/notification-service.js";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
	holdsSeat,
} from "./collaborator-model.js";
import { takeInviteLookupSlot } from "./invite-rate-limits.js";
import {
	INVITE_TTL_MS,
	inviteLinkOf,
	issueInviteToken,
} from "./invite-token.js";
import {
	type InviteTarget,
	alreadyMember,
	assertInvitable,
	isTargetsMembership,
	resolveInviteTarget,
	targetRowsFilter,
} from "./invitee-lookup.js";
import { assertMemberSeats } from "./member-seats.js";

export interface IssuedInvite {
	readonly row: StoredCollaborator;
	readonly target: InviteTarget;
	/** `/invite/:token`; returned once, never stored. */
	readonly inviteLink: string;
	/** Whether the invitee's account was notified (bound invitations). */
	readonly notified: boolean;
}

/** Identity of an invitation, rebuilt from the target every time. */
function identityUpdate(target: InviteTarget): {
	$set: Record<string, string>;
	$unset: Record<string, 1>;
} {
	const $set: Record<string, string> = {};
	const $unset: Record<string, 1> = {};
	if (target.kind === "account") $set.inviteeUserId = target.account.sub;
	else $unset.inviteeUserId = 1;
	if (target.email === null) $unset.inviteeEmail = 1;
	else $set.inviteeEmail = target.email;
	return { $set, $unset };
}

/**
 * Stores the invitation of `target` under the project lock: refuses the
 * target's existing membership, re-issues (new token and expiry, same
 * seat) the oldest pending invitation of the same person or address, and
 * otherwise takes a free member seat. Concurrent invitations of one
 * project serialize on the lock document, so they cannot both pass the
 * member limit.
 */
async function storeInvite(
	project: StoredProject,
	ownerSub: string,
	target: InviteTarget,
	tokenHash: string,
	expiresAt: Date,
): Promise<StoredCollaborator> {
	return inProjectTransaction(project._id, async (session) => {
		const now = new Date();
		const rows = await CollaboratorModel.find(
			targetRowsFilter(project._id, target),
		)
			.sort({ createdAt: 1, _id: 1 })
			.session(session)
			.lean<StoredCollaborator[]>();
		if (rows.some((row) => isTargetsMembership(row, target))) {
			throw alreadyMember();
		}
		// An accepted member invited at this address no longer uses it (or
		// the address would have matched their account): the address is free.
		const formerHolders = rows.filter((row) => row.status === "accepted");
		const [reused, ...duplicates] = rows.filter(
			(row) => row.status !== "accepted",
		);
		if (formerHolders.length > 0) {
			await CollaboratorModel.updateMany(
				{ _id: { $in: formerHolders.map((row) => row._id) } },
				{ $unset: { inviteeEmail: 1 } },
				{ session },
			);
		}
		if (duplicates.length > 0) {
			await CollaboratorModel.deleteMany(
				{ _id: { $in: duplicates.map((row) => row._id) } },
				{ session },
			);
		}
		await assertMemberSeats(
			project,
			session,
			reused && holdsSeat(reused, now) ? 0 : 1,
		);
		const identity = identityUpdate(target);
		const invitation = {
			status: "pending" as const,
			inviteTokenHash: tokenHash,
			expiresAt,
			invitedBy: ownerSub,
		};
		if (!reused) {
			const [created] = await CollaboratorModel.create(
				[{ projectId: project._id, ...invitation, ...identity.$set }],
				{ session },
			);
			if (!created) throw new Error("Invitation was not created");
			return created.toObject<StoredCollaborator>();
		}
		const updated = await CollaboratorModel.findOneAndUpdate(
			{ _id: reused._id },
			{
				$set: { ...invitation, ...identity.$set },
				...(Object.keys(identity.$unset).length > 0
					? { $unset: identity.$unset }
					: {}),
			},
			{ session, returnDocument: "after" },
		).lean<StoredCollaborator>();
		if (!updated) throw new Error("Invitation vanished under the lock");
		return updated;
	});
}

/** `null` lets the notification say "the project owner" in its language. */
async function inviterName(ownerSub: string): Promise<string | null> {
	const owner = await UserModel.findOne({ sub: ownerSub })
		.select("username name")
		.lean<{ username: string; name?: string | null }>();
	return owner?.name || owner?.username || null;
}

/** Never throws once the invitation is stored: its link is shown only now. */
function notifyInvitee(
	notifications: NotificationService,
	project: StoredProject,
	inviter: string | null,
	inviteeSub: string,
	inviteLink: string,
): void {
	const days = INVITE_TTL_MS / (24 * 60 * 60 * 1000);
	notifications.notifyLater(inviteeSub, {
		type: "project.invitation",
		params: { inviter, project: project.name, days },
		link: inviteLink,
	});
}

/**
 * Invites the person `typed` names (username or email) to the project.
 * A matching account is bound to the invitation and notified on its
 * channels (in-app, Web Push, Telegram) with the link; an email without
 * an account gets a link the owner sends themselves, which only an
 * account whose IdP verified that email can accept.
 */
export async function inviteCollaborator(
	project: StoredProject,
	ownerSub: string,
	typed: string,
): Promise<IssuedInvite> {
	await takeInviteLookupSlot(ownerSub);
	const target = await resolveInviteTarget(typed);
	if (!target) {
		throw new OperationError(
			404,
			"INVITEE_NOT_FOUND",
			"No account has this username; invite them by email instead",
		);
	}
	await assertInvitable(project, target);
	const inviter = await inviterName(ownerSub);
	const notifications = getNotificationService();
	const issued = issueInviteToken();
	const row = await storeInvite(
		project,
		ownerSub,
		target,
		issued.tokenHash,
		issued.expiresAt,
	);
	const inviteLink = inviteLinkOf(issued.token);
	if (target.kind === "account") {
		notifyInvitee(
			notifications,
			project,
			inviter,
			target.account.sub,
			inviteLink,
		);
	}
	return { row, target, inviteLink, notified: target.kind === "account" };
}
