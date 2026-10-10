import { OperationError } from "@localman/operations";
import {
	type WorkspaceRole,
	workspaceRoleAllows,
} from "@localman/shared/access";
import type { ClientSession } from "mongoose";
import { z } from "zod";
import { toJsonLimit } from "../billing/plan-guard.js";
import { inWorkspaceTransaction } from "./workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import {
	type MemberView,
	invitationView,
	memberView,
	toInvitationViews,
	toMemberView,
	toMemberViews,
} from "./workspace-member-view.js";
import { handOverOwnership } from "./workspace-ownership.js";
import type { WorkspaceAccess } from "./workspace-roles.js";
import { workspaceSeats } from "./workspace-seats.js";
import { assertTeamWorkspace } from "./workspace-service.js";

export const memberList = z.object({
	members: z.array(memberView),
	/** Pending invitations; listed to Admins only (empty for other roles). */
	invitations: z.array(invitationView),
	/** `null` for a personal workspace, which has no members. */
	seats: z.object({ used: z.number(), max: z.number().nullable() }).nullable(),
});
export type MemberList = z.infer<typeof memberList>;

/** Members of the workspace, oldest first, as the caller may see them. */
export async function listMembers(
	access: WorkspaceAccess,
	viewerSub: string,
): Promise<MemberList> {
	const { workspace, role } = access;
	if (workspace.type === "personal") {
		return { members: [], invitations: [], seats: null };
	}
	const canManage = workspaceRoleAllows(role, "manageMembers");
	const rows = await WorkspaceMemberModel.find({
		workspaceId: workspace._id,
		...(canManage ? {} : { status: "accepted" }),
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredWorkspaceMember[]>();
	const [members, invitations, seats] = await Promise.all([
		toMemberViews(
			rows.filter((row) => row.status === "accepted"),
			viewerSub,
		),
		toInvitationViews(rows.filter((row) => row.status === "pending")),
		workspaceSeats(workspace),
	]);
	return {
		members,
		invitations,
		seats: { used: seats.used, max: toJsonLimit(seats.max) },
	};
}

const lastAdmin = (): OperationError =>
	new OperationError(
		409,
		"LAST_ADMIN",
		"A team workspace needs at least one Admin; make another member Admin first",
	);

const memberNotFound = (): OperationError =>
	new OperationError(404, "NOT_FOUND", "Member not found");

const OBJECT_ID = /^[a-f\d]{24}$/i;

async function findMember(
	access: WorkspaceAccess,
	filter: Record<string, unknown>,
	session: ClientSession | null = null,
): Promise<StoredWorkspaceMember> {
	const row = await WorkspaceMemberModel.findOne({
		...filter,
		workspaceId: access.workspace._id,
		status: "accepted",
	})
		.session(session)
		.lean<StoredWorkspaceMember>();
	if (!row) throw memberNotFound();
	return row;
}

/**
 * Throws `LAST_ADMIN` when `row` is the workspace's only Admin and would
 * stop being one. Run under the workspace lock, so two Admins demoting
 * each other at once cannot leave the workspace without one.
 */
async function assertKeepsAdmin(
	row: StoredWorkspaceMember,
	session: ClientSession | null,
): Promise<void> {
	if (row.role !== "admin") return;
	const admins = await WorkspaceMemberModel.countDocuments({
		workspaceId: row.workspaceId,
		status: "accepted",
		role: "admin",
	}).session(session);
	if (admins <= 1) throw lastAdmin();
}

function memberFilter(memberId: string): Record<string, unknown> {
	if (!OBJECT_ID.test(memberId)) throw memberNotFound();
	return { _id: memberId };
}

export async function changeMemberRole(
	access: WorkspaceAccess,
	viewerSub: string,
	memberId: string,
	role: WorkspaceRole,
): Promise<MemberView> {
	const filter = memberFilter(memberId);
	const updated = await inWorkspaceTransaction(
		access.workspace._id,
		async (session) => {
			const row = await findMember(access, filter, session);
			if (row.role === role) return row;
			if (role !== "admin") await assertKeepsAdmin(row, session);
			const next = await WorkspaceMemberModel.findOneAndUpdate(
				{ _id: row._id },
				{ $set: { role } },
				{ session, returnDocument: "after" },
			).lean<StoredWorkspaceMember>();
			if (!next) throw memberNotFound();
			return next;
		},
	);
	return toMemberView(updated, viewerSub);
}

/**
 * Removes an accepted member (or, with `memberId` of the caller's own
 * row, makes them leave). Access is read from Mongo on every request, so
 * the person loses it at once. The last Admin cannot go.
 */
export async function removeMember(
	access: WorkspaceAccess,
	viewerSub: string,
	filter: Record<string, unknown>,
	dryRun: boolean,
): Promise<MemberView> {
	assertTeamWorkspace(access.workspace);
	const current = await findMember(access, filter);
	if (dryRun) {
		await assertKeepsAdmin(current, null);
		return toMemberView(current, viewerSub);
	}
	const removed = await inWorkspaceTransaction(
		access.workspace._id,
		async (session) => {
			const row = await findMember(access, filter, session);
			await assertKeepsAdmin(row, session);
			await WorkspaceMemberModel.deleteOne({ _id: row._id }, { session });
			if (row.userId) {
				await handOverOwnership(row.workspaceId, row.userId, session);
			}
			return row;
		},
	);
	return toMemberView(removed, viewerSub);
}

export function removeMemberById(
	access: WorkspaceAccess,
	viewerSub: string,
	memberId: string,
	dryRun: boolean,
): Promise<MemberView> {
	return removeMember(access, viewerSub, memberFilter(memberId), dryRun);
}

export function leaveWorkspace(
	access: WorkspaceAccess,
	viewerSub: string,
	dryRun: boolean,
): Promise<MemberView> {
	return removeMember(access, viewerSub, { userId: viewerSub }, dryRun);
}
