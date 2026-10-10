import {
	MOCK_PROJECT_PERMISSIONS,
	type MockProjectAction,
} from "@localman/shared/access";
import type { Types } from "mongoose";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";

/**
 * What a caller may do with a project:
 * - `read`: see the project, its resources and data;
 * - `editResources`: create, change and delete resources and their data;
 * - `clone`: copy the project into the caller's own account;
 * - `update`, `delete`: rename/re-prefix or delete the project itself;
 * - `manageMembers`: invite and remove members, manage the magic link.
 */
export type ProjectAction = MockProjectAction;

export interface ProjectAccessUser {
	readonly sub: string;
}

export interface ProjectAccessTarget {
	readonly _id: Types.ObjectId;
	readonly owner: string;
}

/**
 * Projects shared with the user through an accepted invitation or the
 * magic link. Read from Mongo on every call (no cache), so a member who
 * leaves or is removed loses access at once.
 */
async function acceptedCollaborations(
	userSub: string,
): Promise<Types.ObjectId[]> {
	return CollaboratorModel.distinct("projectId", {
		inviteeUserId: userSub,
		status: "accepted",
	});
}

export type ProjectRole = "owner" | "collaborator";

/**
 * The caller's role in the project, `null` when they have none. One query
 * at most (none for the owner).
 */
export async function roleIn(
	user: ProjectAccessUser,
	project: ProjectAccessTarget,
): Promise<ProjectRole | null> {
	if (project.owner === user.sub) return "owner";
	const row = await CollaboratorModel.exists({
		projectId: project._id,
		inviteeUserId: user.sub,
		status: "accepted",
	});
	return row === null ? null : "collaborator";
}

/**
 * The single authorization rule of projects, read from the shared
 * permission table: the owner is an Editor who also manages the project,
 * a collaborator an Editor who works on resources and data (within the
 * owner's plan) and may copy it, but never renames, re-prefixes or deletes
 * it, nor manages its members.
 */
export function roleAllows(
	role: ProjectRole | null,
	action: ProjectAction,
): boolean {
	if (role === null) return false;
	const allowed: readonly ProjectRole[] = MOCK_PROJECT_PERMISSIONS[action];
	return allowed.includes(role);
}

/**
 * Whether the user may perform `action`. Routes call only this (or
 * `roleIn` + `roleAllows` to tell 404 from 403 with one query) and
 * `accessibleProjectsFilter` for listings, so the rule can later move to a
 * shared access policy without touching them.
 */
export async function can(
	user: ProjectAccessUser,
	action: ProjectAction,
	project: ProjectAccessTarget,
): Promise<boolean> {
	// Only the owner can hold an owner-only action: skip the query.
	if (project.owner !== user.sub && !roleAllows("collaborator", action)) {
		return false;
	}
	return roleAllows(await roleIn(user, project), action);
}

/** Mongo filter of every project the user can read. */
export async function accessibleProjectsFilter(
	user: ProjectAccessUser,
): Promise<Record<string, unknown>> {
	const shared = await acceptedCollaborations(user.sub);
	if (shared.length === 0) return { owner: user.sub };
	return { $or: [{ owner: user.sub }, { _id: { $in: shared } }] };
}
