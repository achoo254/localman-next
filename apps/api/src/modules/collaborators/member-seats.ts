import { LIMITS } from "@localman/shared";
import type { ClientSession } from "mongoose";
import { LimitReachedError } from "../billing/limit-guard.js";
import type { ProjectAccessTarget } from "../projects/project-access.js";
import { CollaboratorModel, seatHoldersFilter } from "./collaborator-model.js";

export interface MemberSeats {
	/** Owner, accepted members and invitations that can still be accepted. */
	readonly used: number;
	/** `LIMITS.membersPerWorkspace`. */
	readonly max: number;
}

/**
 * Seats of a project, counted against `membersPerWorkspace`. Pass the session of the project
 * transaction when the count guards a write.
 */
export async function memberSeats(
	project: ProjectAccessTarget,
	session: ClientSession | null = null,
	now: Date = new Date(),
): Promise<MemberSeats> {
	const holders = await CollaboratorModel.countDocuments(
		seatHoldersFilter(project._id, now),
	).session(session);
	return { used: 1 + holders, max: LIMITS.membersPerWorkspace };
}

/**
 * Throws 403 `PLAN_LIMIT_REACHED` (`limit: "members"`) when `adding` more
 * seats would pass the limit. Callers run it inside the project
 * transaction (see `inProjectTransaction`): two writers of the same
 * project bump the same lock document, so one retries on the other's
 * result instead of both passing the count.
 */
export async function assertMemberSeats(
	project: ProjectAccessTarget,
	session: ClientSession,
	adding: number,
): Promise<void> {
	const seats = await memberSeats(project, session);
	if (seats.used + adding > seats.max) {
		throw new LimitReachedError("members", seats.max, seats.used);
	}
}
