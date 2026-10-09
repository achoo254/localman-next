import type { ClientSession } from "mongoose";
import { inProjectTransaction } from "../projects/project-lock.js";
import {
	callerRows,
	callerRowsFilter,
	verifiedEmailOf,
} from "./caller-rows.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
	holdsSeat,
} from "./collaborator-model.js";
import {
	type ResolvedToken,
	ineligibility,
	resolveToken,
} from "./invite-eligibility.js";
import {
	changedMeanwhile,
	refusal,
	removedByOwner,
} from "./invite-refusals.js";
import { MagicLinkModel } from "./magic-link-model.js";
import {
	MemberRemovalModel,
	wasRemovedByOwner,
} from "./member-removal-model.js";
import { assertMemberSeats } from "./member-seats.js";

export interface AcceptResult {
	readonly projectId: string;
	/** The caller was already the owner or a member; nothing changed. */
	readonly alreadyMember: boolean;
}

/**
 * Accepts the invitation: the row becomes the caller's membership and
 * clears a removal mark. The caller's other pending rows (bound to them,
 * or unbound to the email their IdP verified) are dropped with their
 * seats. The invitation already holds a seat, but the count is checked
 * again in case the owner's plan shrank since.
 */
async function acceptInvitation(
	sub: string,
	verifiedEmail: string | null,
	token: Extract<ResolvedToken, { kind: "invite" }>,
	session: ClientSession,
): Promise<void> {
	const { row } = token;
	const now = new Date();
	const fresh = await CollaboratorModel.exists({
		_id: row._id,
		status: "pending",
		inviteTokenHash: row.inviteTokenHash,
		expiresAt: { $gt: now },
	}).session(session);
	if (!fresh) throw changedMeanwhile();
	await CollaboratorModel.deleteMany(
		{
			...callerRowsFilter(token.project._id, sub, verifiedEmail),
			status: "pending",
			_id: { $ne: row._id },
		},
		{ session },
	);
	await assertMemberSeats(token.project, session, 0);
	await CollaboratorModel.updateOne(
		{ _id: row._id },
		{ $set: { status: "accepted", inviteeUserId: sub, acceptedAt: now } },
		{ session },
	);
	// The owner invited this account again: an earlier removal no longer holds.
	await MemberRemovalModel.deleteOne(
		{ projectId: token.project._id, userSub: sub },
		{ session },
	);
}

/**
 * Joins through the magic link, which holds no seat: the member limit is
 * checked here, under the project lock, so two people joining at once
 * cannot both take the last seat. A pending row of the caller (see
 * `callerRows`) becomes the membership; the others are dropped.
 */
async function joinWithMagicLink(
	sub: string,
	verifiedEmail: string | null,
	token: Extract<ResolvedToken, { kind: "magic" }>,
	session: ClientSession,
): Promise<void> {
	const now = new Date();
	const live = await MagicLinkModel.exists({
		_id: token.link._id,
		tokenHash: token.link.tokenHash,
		revokedAt: null,
		expiresAt: { $gt: now },
	}).session(session);
	if (!live) throw changedMeanwhile();
	// The owner may have removed the caller since the eligibility check.
	if (await wasRemovedByOwner(token.project._id, sub, session)) {
		throw removedByOwner();
	}
	const [own, ...others] = await callerRows(
		token.project._id,
		sub,
		verifiedEmail,
		session,
	);
	if (others.length > 0) {
		await CollaboratorModel.deleteMany(
			{ _id: { $in: others.map((row) => row._id) } },
			{ session },
		);
	}
	await assertMemberSeats(
		token.project,
		session,
		own && holdsSeat(own, now) ? 0 : 1,
	);
	const accepted = { status: "accepted", acceptedAt: now } as const;
	if (own) {
		await CollaboratorModel.updateOne(
			{ _id: own._id },
			{ $set: { ...accepted, inviteeUserId: sub } },
			{ session },
		);
		return;
	}
	await CollaboratorModel.create(
		[
			{
				projectId: token.project._id,
				inviteeUserId: sub,
				invitedBy: token.link.createdBy,
				...accepted,
			},
		],
		{ session },
	);
}

/**
 * Makes `sub` an accepted collaborator through an invite or magic link
 * token, or tells them they already are one (idempotent for the owner and
 * members, so a double click or a reopened link just leads to the
 * project).
 */
export async function acceptToken(
	sub: string,
	rawToken: string,
): Promise<AcceptResult> {
	const token = await resolveToken(rawToken);
	const projectId = token.project._id.toHexString();
	const reason = await ineligibility(sub, token);
	if (reason === "ALREADY_MEMBER") return { projectId, alreadyMember: true };
	if (reason) throw await refusal(reason, token);
	const verifiedEmail = await verifiedEmailOf(sub);
	const alreadyMember = await inProjectTransaction(
		token.project._id,
		async (session) => {
			const member = await CollaboratorModel.exists({
				projectId: token.project._id,
				inviteeUserId: sub,
				status: "accepted",
			}).session(session);
			if (member) return true;
			if (token.kind === "invite") {
				await acceptInvitation(sub, verifiedEmail, token, session);
			} else {
				await joinWithMagicLink(sub, verifiedEmail, token, session);
			}
			return false;
		},
	);
	return { projectId, alreadyMember };
}
