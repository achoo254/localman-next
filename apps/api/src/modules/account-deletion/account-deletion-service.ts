import { OperationError } from "@localman/operations";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { forgetKnownSubject } from "../mcp/localman-mcp-limits.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "../projects/project-model.js";
import { deleteProjectCascade } from "../projects/project-service.js";
import { UserModel } from "../users/user-model.js";
import { deleteOwnerLock } from "../workspaces/workspace-lock.js";
import { accountDeletionLog } from "./account-deletion-log.js";
import {
	type ErasedCount,
	deleteOwnRows,
	revokeSessions,
} from "./account-own-rows.js";
import { anonymizeReferences } from "./account-references.js";
import { revokeTunnelLinks } from "./account-tunnel-links.js";
import {
	type BlockingWorkspace,
	applyWorkspacePlan,
	countCollectionsOf,
	planWorkspaces,
	purgeOrphanedTrash,
} from "./account-workspaces.js";
import {
	markAccountDeleted,
	releaseDeletionLock,
	takeDeletionLock,
} from "./deleted-account-model.js";

/** What deleting the account would do (the dry run), or did. */
export interface AccountDeletionSummary {
	/** Mock projects the account owns, deleted with everything in them. */
	readonly ownedProjects: number;
	/** Of those, the ones other people are members of. */
	readonly sharedProjects: number;
	/** People who are members of those projects and lose them. */
	readonly projectMembers: number;
	/** The personal workspace and team workspaces with no other member. */
	readonly workspacesDeleted: number;
	/** Team workspaces the account leaves; their content stays. */
	readonly workspacesLeft: number;
	/** Collections in the deleted workspaces. */
	readonly collectionsDeleted: number;
	/** Team workspaces that stop the deletion until someone else is Admin. */
	readonly blockedWorkspaces: readonly BlockingWorkspace[];
}

function blocked(count: number): OperationError {
	return new OperationError(
		409,
		"ACCOUNT_DELETION_BLOCKED",
		"You are the only Admin of a team workspace that has other members. Make another member Admin, or remove the other members, then try again.",
		{ blockedWorkspaces: count },
	);
}

async function ownedProjects(sub: string): Promise<StoredProject[]> {
	return ProjectModel.find({ owner: sub }).lean<StoredProject[]>();
}

/** The dry run: counts, and what blocks the deletion. */
export async function previewAccountDeletion(
	sub: string,
): Promise<AccountDeletionSummary> {
	const projects = await ProjectModel.find(
		{ owner: sub, ...LIVE_PROJECT },
		{ _id: 1 },
	).lean<{ _id: StoredProject["_id"] }[]>();
	const owned = projects.map((project) => project._id);
	const shared = await CollaboratorModel.distinct("projectId", {
		projectId: { $in: owned },
		status: "accepted",
	});
	const members = await CollaboratorModel.distinct("inviteeUserId", {
		projectId: { $in: owned },
		status: "accepted",
	});
	const plan = await planWorkspaces(sub);
	return {
		ownedProjects: projects.length,
		sharedProjects: shared.length,
		projectMembers: members.length,
		workspacesDeleted: plan.toDelete.length,
		workspacesLeft: plan.toLeave.length,
		collectionsDeleted: await countCollectionsOf(plan.toDelete),
		blockedWorkspaces: plan.blocked,
	};
}

function inProgress(): OperationError {
	return new OperationError(
		409,
		"ACCOUNT_DELETION_IN_PROGRESS",
		"Your account is already being deleted; wait a moment and reload",
	);
}

/**
 * Deletes the account's Localman data (docs/decisions/0007), one deletion
 * per account at a time (a second one answers 409 in progress). Nothing
 * is touched before the workspace check passes on the plan that is then
 * applied: workspaces first (each re-checked under its lock), then every
 * session, owned projects, own rows, anonymization, Tunelo links, and
 * the user row last, after the hashed tombstone. Every step is
 * idempotent: a deletion that fails half way leaves the user row, so
 * signing in again and deleting again finishes it. The IdP account is
 * not touched (it is deleted at the IdP).
 */
export async function deleteAccount(
	sub: string,
): Promise<AccountDeletionSummary> {
	if (!(await takeDeletionLock(sub))) throw inProgress();
	try {
		return await deleteLocked(sub);
	} finally {
		await releaseDeletionLock(sub);
	}
}

async function deleteLocked(sub: string): Promise<AccountDeletionSummary> {
	const summary = await previewAccountDeletion(sub);
	const plan = await planWorkspaces(sub);
	if (plan.blocked.length > 0) throw blocked(plan.blocked.length);
	await applyWorkspacePlan(sub, plan);
	const counts: ErasedCount[] = [...(await revokeSessions(sub))];
	forgetKnownSubject(sub);
	for (const project of await ownedProjects(sub)) {
		await deleteProjectCascade(project);
	}
	const purgedTrash = await purgeOrphanedTrash(sub);
	counts.push(...(await deleteOwnRows(sub)));
	counts.push(...(await anonymizeReferences(sub)));
	counts.push(await revokeTunnelLinks(sub));
	await deleteOwnerLock(sub);
	await markAccountDeleted(sub);
	const user = await UserModel.deleteOne({ sub });
	// Again after the row is gone: an MCP request in between would have
	// cached the subject as known for its TTL.
	forgetKnownSubject(sub);
	counts.push({ collection: "users", count: user.deletedCount });
	accountDeletionLog().info(
		{
			sub,
			projects: summary.ownedProjects,
			workspacesDeleted: plan.toDelete.length,
			workspacesLeft: plan.toLeave.length,
			purgedTrash,
			counts: counts.filter((entry) => entry.count > 0),
		},
		"Account deleted",
	);
	return summary;
}
