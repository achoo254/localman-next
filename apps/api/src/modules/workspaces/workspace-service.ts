import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { WorkspaceRole } from "@localman/shared/access";
import { PlanLimitError, currentPlanOf } from "../billing/plan-guard.js";
import {
	countLiveCollections,
	trashWorkspaceCollections,
} from "../collections/workspace-collections.js";
import { ensurePersonalWorkspace } from "./personal-workspace.js";
import {
	inOwnerTransaction,
	inWorkspaceTransaction,
} from "./workspace-lock.js";
import { WorkspaceMemberModel } from "./workspace-member-model.js";
import { type StoredWorkspace, WorkspaceModel } from "./workspace-model.js";
import {
	type WorkspaceView,
	memberCounts,
	toWorkspaceView,
} from "./workspace-view.js";

export interface WorkspaceDetailsInput {
	readonly name?: string;
	/** `null` or an empty string clears the description. */
	readonly description?: string | null;
}

/** Refuses member and lifecycle changes of a personal workspace. */
export function assertTeamWorkspace(workspace: StoredWorkspace): void {
	if (workspace.type !== "team") {
		throw new OperationError(
			409,
			"PERSONAL_WORKSPACE",
			"A personal workspace has no members and cannot be deleted or left",
		);
	}
}

/**
 * The caller's personal workspace (created on first use) and the team
 * workspaces they are an accepted member of, oldest first.
 */
export async function listWorkspaces(sub: string): Promise<WorkspaceView[]> {
	const personal = await ensurePersonalWorkspace(sub);
	const rows = await WorkspaceMemberModel.find(
		{ userId: sub, status: "accepted" },
		{ workspaceId: 1, role: 1 },
	).lean<{ workspaceId: StoredWorkspace["_id"]; role: WorkspaceRole }[]>();
	const roles = new Map(
		rows.map((row) => [row.workspaceId.toHexString(), row.role]),
	);
	const teams = await WorkspaceModel.find({
		_id: { $in: rows.map((row) => row.workspaceId) },
		type: "team",
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredWorkspace[]>();
	const counts = await memberCounts(teams.map((team) => team._id));
	const views = [toWorkspaceView(personal, "admin", counts)];
	for (const team of teams) {
		const role = roles.get(team._id.toHexString());
		if (role) views.push(toWorkspaceView(team, role, counts));
	}
	return views;
}

/**
 * Creates a team workspace whose first Admin is the creator, within the
 * `teamWorkspaces` of their plan (team workspaces they own). Creations by
 * one user serialize on their owner lock, so racers cannot both pass.
 */
export async function createTeamWorkspace(
	sub: string,
	input: { readonly name: string; readonly description?: string | null },
): Promise<StoredWorkspace> {
	const max = limitsFor(await currentPlanOf(sub)).teamWorkspaces;
	return inOwnerTransaction(sub, async (session) => {
		const owned = await WorkspaceModel.countDocuments({
			ownerId: sub,
			type: "team",
		}).session(session);
		if (owned >= max) {
			throw new PlanLimitError("teamWorkspaces", max, owned);
		}
		const [created] = await WorkspaceModel.create(
			[
				{
					name: input.name,
					...(input.description ? { description: input.description } : {}),
					type: "team",
					visibility: "team",
					ownerId: sub,
				},
			],
			{ session },
		);
		if (!created) throw new Error("Workspace was not created");
		await WorkspaceMemberModel.create(
			[
				{
					workspaceId: created._id,
					userId: sub,
					role: "admin",
					status: "accepted",
					invitedBy: sub,
					acceptedAt: new Date(),
				},
			],
			{ session },
		);
		return created.toObject<StoredWorkspace>();
	});
}

export async function updateWorkspaceDetails(
	workspace: StoredWorkspace,
	input: WorkspaceDetailsInput,
): Promise<StoredWorkspace> {
	const $set: Record<string, string> = {};
	const $unset: Record<string, 1> = {};
	if (input.name !== undefined) $set.name = input.name;
	if (input.description !== undefined) {
		if (input.description) $set.description = input.description;
		else $unset.description = 1;
	}
	const updated = await WorkspaceModel.findByIdAndUpdate(
		workspace._id,
		{
			...(Object.keys($set).length > 0 ? { $set } : {}),
			...(Object.keys($unset).length > 0 ? { $unset } : {}),
		},
		{ returnDocument: "after", runValidators: true },
	).lean<StoredWorkspace>();
	if (!updated) {
		throw new OperationError(404, "NOT_FOUND", "Workspace not found");
	}
	return updated;
}

export interface WorkspaceDeletion {
	/** Members (and pending invitations) it had. */
	readonly members: number;
	/** Live collections moved to the trash with it. */
	readonly collections: number;
}

/**
 * Deletes a team workspace and its member rows (members and invitations)
 * under the workspace lock, so no invitation or acceptance racing the
 * deletion survives it. Its live collections go to the trash in the same
 * transaction, deleted by `sub`, who can restore them into another
 * workspace. A dry run only counts.
 */
export async function deleteTeamWorkspace(
	workspace: StoredWorkspace,
	dryRun: boolean,
	sub: string,
): Promise<WorkspaceDeletion> {
	assertTeamWorkspace(workspace);
	const counts = await memberCounts([workspace._id]);
	const members = counts.get(workspace._id.toHexString()) ?? 0;
	if (dryRun) {
		return { members, collections: await countLiveCollections(workspace._id) };
	}
	const collections = await inWorkspaceTransaction(
		workspace._id,
		async (session) => {
			const trashed = await trashWorkspaceCollections(
				workspace._id,
				sub,
				session,
			);
			await WorkspaceModel.deleteOne({ _id: workspace._id }, { session });
			await WorkspaceMemberModel.deleteMany(
				{ workspaceId: workspace._id },
				{ session },
			);
			return trashed;
		},
	);
	return { members, collections };
}
