import { OperationError } from "@localman/operations";
import { addresseeProblem } from "../access/invite-addressee.js";
import { PlanLimitError } from "../billing/plan-guard.js";
import { verifiedEmailOf } from "../collaborators/caller-rows.js";
import { hashInviteToken } from "../collaborators/invite-token.js";
import { inWorkspaceTransaction } from "./workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import type { StoredWorkspace } from "./workspace-model.js";
import { findWorkspaceById, workspaceRoleOf } from "./workspace-roles.js";
import { assertWorkspaceSeats, workspaceSeats } from "./workspace-seats.js";

export const WORKSPACE_INELIGIBLE_REASONS = [
	"NOT_INVITEE",
	"EMAIL_NOT_VERIFIED",
	"ALREADY_MEMBER",
	"MEMBER_LIMIT",
] as const;
export type WorkspaceIneligibleReason =
	(typeof WORKSPACE_INELIGIBLE_REASONS)[number];

/** A workspace invitation found by its token. */
export interface WorkspaceToken {
	readonly workspace: StoredWorkspace;
	readonly row: StoredWorkspaceMember;
}

const inviteNotFound = (): OperationError =>
	new OperationError(404, "INVITE_NOT_FOUND", "This invite link is not valid");

/**
 * The invitation a token belongs to. Unknown, revoked and re-issued tokens
 * and tokens of deleted workspaces are all `INVITE_NOT_FOUND`. The
 * workspace comes from the stored row, never from the request.
 */
export async function resolveWorkspaceToken(
	token: string,
): Promise<WorkspaceToken> {
	const row = await WorkspaceMemberModel.findOne({
		inviteTokenHash: hashInviteToken(token),
	}).lean<StoredWorkspaceMember>();
	const workspace = row
		? await findWorkspaceById(row.workspaceId.toHexString())
		: null;
	if (!row || !workspace) throw inviteNotFound();
	return { workspace, row };
}

/** Throws when the token can no longer be used by anyone. */
function assertUsable(row: StoredWorkspaceMember, now: Date): void {
	if (row.status === "accepted") {
		throw new OperationError(
			410,
			"INVITE_USED",
			"This invite link was already used",
		);
	}
	const expiresAt = row.expiresAt ?? null;
	if (!expiresAt || expiresAt <= now) {
		throw new OperationError(
			410,
			"INVITE_EXPIRED",
			"This invite link expired",
			{
				expiresAt: expiresAt?.toISOString() ?? null,
			},
		);
	}
}

/**
 * Why `sub` cannot accept, or `null` when they can. Members are told so
 * before the token's state is checked, so a used or expired link still
 * leads them to the workspace. An addressed invitation admits only its
 * addressee (`addresseeProblem`); a link one admits anyone signed in.
 * Throws the token errors (`INVITE_USED`, `INVITE_EXPIRED`).
 */
export async function workspaceIneligibility(
	sub: string,
	token: WorkspaceToken,
	now: Date = new Date(),
): Promise<WorkspaceIneligibleReason | null> {
	if ((await workspaceRoleOf(sub, token.workspace)) !== null) {
		return "ALREADY_MEMBER";
	}
	assertUsable(token.row, now);
	const { userId, email } = token.row;
	if (userId || email) {
		const problem = await addresseeProblem(sub, { userId, email });
		if (problem) return problem;
	}
	// The invitation holds its seat already; the owner's plan may have shrunk.
	const seats = await workspaceSeats(token.workspace, null, now);
	return seats.used > seats.max ? "MEMBER_LIMIT" : null;
}

async function refusal(
	reason: Exclude<WorkspaceIneligibleReason, "ALREADY_MEMBER">,
	token: WorkspaceToken,
): Promise<OperationError> {
	if (reason === "MEMBER_LIMIT") {
		const seats = await workspaceSeats(token.workspace);
		return new PlanLimitError("members", seats.max, seats.used);
	}
	if (reason === "EMAIL_NOT_VERIFIED") {
		return new OperationError(
			403,
			"EMAIL_NOT_VERIFIED",
			"Your email matches the invitation but is not verified; link Google or GitHub with this email, or sign in with the invited account",
		);
	}
	return new OperationError(
		403,
		"NOT_INVITEE",
		"This invitation is for another account",
	);
}

export interface WorkspaceAcceptResult {
	readonly workspaceId: string;
	/** The caller was already a member; nothing changed. */
	readonly alreadyMember: boolean;
}

/**
 * Makes `sub` an accepted member with the invitation's role, or tells them
 * they already are one (idempotent, so a double click just leads to the
 * workspace). The row itself becomes the membership, so a link is used
 * once; the caller's other pending invitations of the workspace are
 * dropped with their seats.
 */
export async function acceptWorkspaceInvite(
	sub: string,
	rawToken: string,
): Promise<WorkspaceAcceptResult> {
	const token = await resolveWorkspaceToken(rawToken);
	const { workspace, row } = token;
	const workspaceId = workspace._id.toHexString();
	const reason = await workspaceIneligibility(sub, token);
	if (reason === "ALREADY_MEMBER") return { workspaceId, alreadyMember: true };
	if (reason) throw await refusal(reason, token);
	const verifiedEmail = await verifiedEmailOf(sub);
	const alreadyMember = await inWorkspaceTransaction(
		workspace._id,
		async (session) => {
			const now = new Date();
			const member = await WorkspaceMemberModel.exists({
				workspaceId: workspace._id,
				userId: sub,
				status: "accepted",
			}).session(session);
			if (member) return true;
			const fresh = await WorkspaceMemberModel.exists({
				_id: row._id,
				status: "pending",
				inviteTokenHash: row.inviteTokenHash,
				expiresAt: { $gt: now },
			}).session(session);
			if (!fresh) {
				throw new OperationError(
					409,
					"CONFLICT",
					"The invite link changed meanwhile; open it again",
				);
			}
			const own: Record<string, unknown>[] = [{ userId: sub }];
			if (verifiedEmail !== null) {
				own.push({ userId: { $exists: false }, email: verifiedEmail });
			}
			await WorkspaceMemberModel.deleteMany(
				{
					workspaceId: workspace._id,
					status: "pending",
					_id: { $ne: row._id },
					$or: own,
				},
				{ session },
			);
			await assertWorkspaceSeats(workspace, session, 0);
			await WorkspaceMemberModel.updateOne(
				{ _id: row._id },
				{
					$set: { status: "accepted", userId: sub, acceptedAt: now },
					$unset: { email: 1 },
				},
				{ session },
			);
			return false;
		},
	);
	return { workspaceId, alreadyMember };
}
