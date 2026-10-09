import { OperationError } from "@localman/operations";
import { z } from "zod";
import { toJsonLimit } from "../billing/plan-guard.js";
import { can } from "../projects/project-access.js";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
} from "./collaborator-model.js";
import {
	type CollaboratorView,
	collaboratorView,
	memberProfile,
	toCollaboratorView,
	toCollaboratorViews,
} from "./collaborator-view.js";
import { MemberRemovalModel } from "./member-removal-model.js";
import { memberSeats } from "./member-seats.js";

export const collaboratorList = z.object({
	owner: memberProfile,
	/** Owner, accepted members and pending invitations, against the plan. */
	seats: z.object({ used: z.number(), max: z.number().nullable() }),
	/** The caller is the owner: may invite, remove and manage the link. */
	canManage: z.boolean(),
	items: z.array(collaboratorView),
});
export type CollaboratorList = z.infer<typeof collaboratorList>;

/**
 * Members of a project as `viewerSub` may see them: the owner gets every
 * row (pending and expired invitations with their emails, oldest first);
 * a collaborator only the accepted members, without emails.
 */
export async function listCollaborators(
	project: StoredProject,
	viewerSub: string,
): Promise<CollaboratorList> {
	const isOwner = await can({ sub: viewerSub }, "manageMembers", project);
	const rows = await CollaboratorModel.find({
		projectId: project._id,
		...(isOwner ? {} : { status: "accepted" }),
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredCollaborator[]>();
	const [owner, seats, items] = await Promise.all([
		UserModel.findOne({ sub: project.owner })
			.select("sub username name picture")
			.lean<{
				username: string;
				name?: string | null;
				picture?: string | null;
			}>(),
		memberSeats(project),
		toCollaboratorViews(rows, { showEmails: isOwner }),
	]);
	return {
		owner: {
			sub: project.owner,
			// A user row always exists after sign-in; fall back defensively.
			username: owner?.username ?? project.owner,
			name: owner?.name ?? null,
			picture: owner?.picture ?? null,
		},
		seats: { used: seats.used, max: toJsonLimit(seats.max) },
		canManage: isOwner,
		items,
	};
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Removes a member or cancels an invitation (owner), or leaves the
 * project (a collaborator removing their own membership). Access is read
 * from Mongo on every request, so the person loses it at once. A member
 * the owner removes is marked (`MemberRemovalModel`) so the magic link
 * cannot bring them back. Rows a collaborator cannot see (pending
 * invitations) answer 404.
 */
export async function removeCollaborator(
	project: StoredProject,
	callerSub: string,
	collaboratorId: string,
	dryRun: boolean,
): Promise<CollaboratorView> {
	const row = OBJECT_ID.test(collaboratorId)
		? await CollaboratorModel.findOne({
				_id: collaboratorId,
				projectId: project._id,
			}).lean<StoredCollaborator>()
		: null;
	const isOwner = await can({ sub: callerSub }, "manageMembers", project);
	if (!row || (!isOwner && row.status !== "accepted")) {
		throw new OperationError(404, "NOT_FOUND", "Collaborator not found");
	}
	if (!isOwner && row.inviteeUserId !== callerSub) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only the owner can remove other members",
		);
	}
	const view = await toCollaboratorView(row, { showEmails: isOwner });
	if (dryRun) return view;
	const removedSub = row.status === "accepted" ? row.inviteeUserId : null;
	if (!isOwner || !removedSub) {
		await CollaboratorModel.deleteOne({ _id: row._id });
		return view;
	}
	// Under the project lock, so no mark outlives a project deletion.
	await inProjectTransaction(project._id, async (session) => {
		await MemberRemovalModel.updateOne(
			{ projectId: project._id, userSub: removedSub },
			{ $set: { removedBy: callerSub, removedAt: new Date() } },
			{ upsert: true, session },
		);
		await CollaboratorModel.deleteOne({ _id: row._id }, { session });
	});
	return view;
}
