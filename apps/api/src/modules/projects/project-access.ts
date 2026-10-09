import type { Types } from "mongoose";

/** What a caller may do with a project. */
export type ProjectAction = "read" | "update" | "delete" | "clone";

export interface ProjectAccessUser {
	readonly sub: string;
}

export interface ProjectAccessTarget {
	readonly _id: Types.ObjectId;
	readonly owner: string;
}

/**
 * Collaborators use a project (and copy it into their own account) but
 * never rename, re-prefix or delete it.
 */
const COLLABORATOR_ACTIONS: ReadonlySet<ProjectAction> = new Set([
	"read",
	"clone",
]);

/**
 * Projects shared with the user through an accepted invitation. Invitations
 * do not exist yet, so nobody is a collaborator; the collaborator module
 * answers here once it stores them.
 */
async function acceptedCollaborations(
	_userSub: string,
): Promise<readonly Types.ObjectId[]> {
	return [];
}

/**
 * The single authorization rule of projects: the owner may do everything,
 * an accepted collaborator what `COLLABORATOR_ACTIONS` allows. Routes call
 * only this function (and `accessibleProjectsFilter` for listings), so the
 * rule can later move to a shared access policy without touching them.
 */
export async function can(
	user: ProjectAccessUser,
	action: ProjectAction,
	project: ProjectAccessTarget,
): Promise<boolean> {
	if (project.owner === user.sub) return true;
	if (!COLLABORATOR_ACTIONS.has(action)) return false;
	const shared = await acceptedCollaborations(user.sub);
	return shared.some((id) => id.equals(project._id));
}

/** Mongo filter of every project the user can read. */
export async function accessibleProjectsFilter(
	user: ProjectAccessUser,
): Promise<Record<string, unknown>> {
	const shared = await acceptedCollaborations(user.sub);
	if (shared.length === 0) return { owner: user.sub };
	return { $or: [{ owner: user.sub }, { _id: { $in: shared } }] };
}
