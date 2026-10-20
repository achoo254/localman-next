import { OperationError } from "@localman/operations";
import type { Types } from "mongoose";
import { CollectionModel } from "../collections/collection-model.js";
import { IN_TRASH } from "../collections/trash-access.js";
import { purgeCollection } from "../collections/trash-purge.js";
import { trashWorkspaceCollections } from "../collections/workspace-collections.js";
import { deleteWorkspaceEnvironments } from "../environments/environment-delete-service.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import {
	type StoredWorkspaceMember,
	WorkspaceMemberModel,
} from "../workspaces/workspace-member-model.js";
import { leaveWorkspace } from "../workspaces/workspace-membership.js";
import {
	type StoredWorkspace,
	WorkspaceModel,
} from "../workspaces/workspace-model.js";
import type { WorkspaceAccess } from "../workspaces/workspace-roles.js";
import { DELETED_USER } from "./account-references.js";

export interface BlockingWorkspace {
	readonly id: string;
	readonly name: string;
}

export interface WorkspacePlan {
	/** The personal workspace and team workspaces with no other member. */
	readonly toDelete: readonly StoredWorkspace[];
	/** Team workspaces that keep their other members and an Admin. */
	readonly toLeave: readonly WorkspaceAccess[];
	/**
	 * Team workspaces where the account is the only Admin of other
	 * members: someone must be made Admin first (Jev's default rule).
	 */
	readonly blocked: readonly BlockingWorkspace[];
}

interface Membership {
	readonly workspaceId: Types.ObjectId;
	readonly role: StoredWorkspaceMember["role"];
}

/** What deleting the account does to each workspace it is in. */
export async function planWorkspaces(sub: string): Promise<WorkspacePlan> {
	const personal = await WorkspaceModel.find({
		ownerId: sub,
		type: "personal",
	}).lean<StoredWorkspace[]>();
	const memberships = await WorkspaceMemberModel.find(
		{ userId: sub, status: "accepted" },
		{ workspaceId: 1, role: 1 },
	).lean<Membership[]>();
	const teams = await WorkspaceModel.find({
		_id: { $in: memberships.map((row) => row.workspaceId) },
		type: "team",
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredWorkspace[]>();
	const roles = new Map(
		memberships.map((row) => [row.workspaceId.toHexString(), row.role]),
	);
	const toDelete = [...personal];
	const toLeave: WorkspaceAccess[] = [];
	const blocked: BlockingWorkspace[] = [];
	for (const team of teams) {
		const role = roles.get(team._id.toHexString());
		if (!role) continue;
		const others = await WorkspaceMemberModel.find(
			{ workspaceId: team._id, status: "accepted", userId: { $ne: sub } },
			{ role: 1 },
		).lean<{ role: StoredWorkspaceMember["role"] }[]>();
		if (others.length === 0) {
			toDelete.push(team);
		} else if (
			role === "admin" &&
			!others.some((member) => member.role === "admin")
		) {
			blocked.push({ id: team._id.toHexString(), name: team.name });
		} else {
			toLeave.push({ workspace: team, role });
		}
	}
	return { toDelete, toLeave, blocked };
}

/** Collections (live or in the trash) that go with the deleted workspaces. */
export function countCollectionsOf(
	workspaces: readonly StoredWorkspace[],
): Promise<number> {
	return CollectionModel.countDocuments({
		workspaceId: { $in: workspaces.map((workspace) => workspace._id) },
	});
}

/**
 * Deletes a workspace for good. Under the workspace lock it checks again
 * that no one else is a member (someone who joined since the plan makes
 * the deletion stop with a retryable 409, nothing deleted), then moves
 * every collection to the trash and deletes the environments, globals,
 * member rows and the workspace. Only after that commit are its trashed
 * collections purged (nobody else could restore them); one that fails is
 * left to the trash purge job.
 */
async function deleteWorkspaceForGood(
	workspaceId: Types.ObjectId,
	sub: string,
): Promise<void> {
	await inWorkspaceTransaction(workspaceId, async (session) => {
		const others = await WorkspaceMemberModel.countDocuments({
			workspaceId,
			status: "accepted",
			userId: { $ne: sub },
		}).session(session);
		if (others > 0) throw workspaceChanged();
		await trashWorkspaceCollections(workspaceId, DELETED_USER, session);
		await deleteWorkspaceEnvironments(workspaceId, session);
		await WorkspaceModel.deleteOne({ _id: workspaceId }, { session });
		await WorkspaceMemberModel.deleteMany({ workspaceId }, { session });
	});
	const ids = await CollectionModel.find(
		{ workspaceId, ...IN_TRASH },
		{ _id: 1 },
	).lean<{ _id: Types.ObjectId }[]>();
	for (const { _id } of ids) await purgeCollection(_id);
}

function workspaceChanged(): OperationError {
	return new OperationError(
		409,
		"ACCOUNT_DELETION_CONFLICT",
		"A workspace changed while your account was being deleted; try again",
	);
}

/**
 * Applies `plan`: deletes the workspaces the account is alone in and
 * leaves the others the way "Leave workspace" does (ownership moves to
 * the oldest Admin). A blocked plan is refused before this runs.
 */
export async function applyWorkspacePlan(
	sub: string,
	plan: WorkspacePlan,
): Promise<void> {
	for (const workspace of plan.toDelete) {
		await deleteWorkspaceForGood(workspace._id, sub);
	}
	for (const access of plan.toLeave) {
		await leaveWorkspace(access, sub, false);
	}
}

/**
 * Purges trashed collections of deleted workspaces that only this account
 * could still restore (it deleted them and no other former Admin or
 * Editor is recorded); anyone else's right to restore is kept.
 */
export async function purgeOrphanedTrash(sub: string): Promise<number> {
	const trashed = await CollectionModel.find(
		{ ...IN_TRASH, $or: [{ deletedBy: sub }, { trashEditors: sub }] },
		{ workspaceId: 1, deletedBy: 1, trashEditors: 1 },
	).lean<
		{
			_id: Types.ObjectId;
			workspaceId: Types.ObjectId;
			deletedBy?: string | null;
			trashEditors?: string[] | null;
		}[]
	>();
	let purged = 0;
	for (const row of trashed) {
		if (await WorkspaceModel.exists({ _id: row.workspaceId })) continue;
		const restorers = [row.deletedBy, ...(row.trashEditors ?? [])].filter(
			(who) => who && who !== sub && who !== DELETED_USER,
		);
		if (restorers.length > 0) continue;
		if (await purgeCollection(row._id)) purged += 1;
	}
	return purged;
}
