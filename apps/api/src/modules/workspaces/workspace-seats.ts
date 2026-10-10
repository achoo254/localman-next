import { limitsFor } from "@localman/shared";
import type { ClientSession, Types } from "mongoose";
import { PlanLimitError, currentPlanOf } from "../billing/plan-guard.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "./workspace-member-model.js";
import type { StoredWorkspace } from "./workspace-model.js";

export interface WorkspaceSeats {
	/** Accepted members and invitations that can still be accepted. */
	readonly used: number;
	/** `membersPerWorkspace` of the owner's plan in force. */
	readonly max: number;
}

/** Whether the row takes a member seat (see `seatHoldersFilter`). */
export function holdsSeat(
	row: Pick<StoredWorkspaceMember, "status" | "expiresAt">,
	now: Date,
): boolean {
	if (row.status === "accepted") return true;
	return row.expiresAt instanceof Date && row.expiresAt > now;
}

/**
 * Rows that take a seat: accepted members (the creator included) and
 * invitations that can still be accepted. Expired invitations free theirs.
 */
export function seatHoldersFilter(
	workspaceId: Types.ObjectId,
	now: Date,
): Record<string, unknown> {
	return {
		workspaceId,
		$or: [
			{ status: "accepted" },
			{ status: "pending", expiresAt: { $gt: now } },
		],
	};
}

/**
 * Seats of a team workspace, counted against its owner's plan (a member
 * never brings their own). Pass the session of the workspace transaction
 * when the count guards a write.
 */
export async function workspaceSeats(
	workspace: Pick<StoredWorkspace, "_id" | "ownerId">,
	session: ClientSession | null = null,
	now: Date = new Date(),
): Promise<WorkspaceSeats> {
	const plan = await currentPlanOf(workspace.ownerId);
	const used = await WorkspaceMemberModel.countDocuments(
		seatHoldersFilter(workspace._id, now),
	).session(session);
	return { used, max: limitsFor(plan).membersPerWorkspace };
}

/**
 * Throws 403 `PLAN_LIMIT_REACHED` (`limit: "members"`) when `adding` more
 * seats would pass the owner's plan. Run it inside `inWorkspaceTransaction`
 * so concurrent writers of the workspace serialize on its lock.
 */
export async function assertWorkspaceSeats(
	workspace: Pick<StoredWorkspace, "_id" | "ownerId">,
	session: ClientSession,
	adding: number,
): Promise<void> {
	const seats = await workspaceSeats(workspace, session);
	if (seats.used + adding > seats.max) {
		throw new PlanLimitError("members", seats.max, seats.used);
	}
}
