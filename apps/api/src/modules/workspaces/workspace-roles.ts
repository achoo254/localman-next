import { OperationError } from "@localman/operations";
import {
	type WorkspaceAction,
	type WorkspaceRole,
	workspaceRoleAllows,
} from "@localman/shared/access";
import { Types } from "mongoose";
import { WorkspaceMemberModel } from "./workspace-member-model.js";
import { type StoredWorkspace, WorkspaceModel } from "./workspace-model.js";

/**
 * The user's role in the workspace, `null` when they have none: the owner
 * of a personal workspace is its Admin (it has no other member), a team
 * workspace's members hold the role of their accepted row. Read from Mongo
 * on every call, so a removed member loses access at once.
 */
export async function workspaceRoleOf(
	userSub: string,
	workspace: Pick<StoredWorkspace, "_id" | "type" | "ownerId">,
): Promise<WorkspaceRole | null> {
	if (workspace.type === "personal") {
		return workspace.ownerId === userSub ? "admin" : null;
	}
	const row = await WorkspaceMemberModel.findOne(
		{ workspaceId: workspace._id, userId: userSub, status: "accepted" },
		{ role: 1 },
	).lean<{ role: WorkspaceRole }>();
	return row?.role ?? null;
}

export async function findWorkspaceById(
	workspaceId: string,
): Promise<StoredWorkspace | null> {
	if (!Types.ObjectId.isValid(workspaceId)) return null;
	return WorkspaceModel.findById(workspaceId).lean<StoredWorkspace>();
}

/** A workspace with the caller's role in it. */
export interface WorkspaceAccess {
	readonly workspace: StoredWorkspace;
	readonly role: WorkspaceRole;
}

/**
 * The workspace if the user may perform `action` in it. A workspace the
 * user is not a member of answers 404, so its existence never leaks; one
 * they belong to but may not change answers 403.
 */
export async function requireWorkspace(
	userSub: string,
	action: WorkspaceAction,
	workspaceId: string,
): Promise<WorkspaceAccess> {
	const workspace = await findWorkspaceById(workspaceId);
	const role = workspace ? await workspaceRoleOf(userSub, workspace) : null;
	if (!workspace || role === null) {
		throw new OperationError(404, "NOT_FOUND", "Workspace not found");
	}
	if (!workspaceRoleAllows(role, action)) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return { workspace, role };
}
