import { OperationError } from "@localman/operations";
import type { Types } from "mongoose";
import { forgetKnownSubject } from "../mcp/localman-mcp-limits.js";
import { UserModel } from "../users/user-model.js";
import { deleteOwnerLock } from "../workspaces/workspace-lock.js";
import { accountDeletionLog } from "./account-deletion-log.js";
import {
	type ErasedCount,
	deleteOwnRows,
	revokeSessions,
} from "./account-own-rows.js";
import { transferOrDeleteProjects } from "./account-projects.js";
import { anonymizeReferences } from "./account-references.js";
import { revokeTunnelLinks } from "./account-tunnel-links.js";
import {
	applyWorkspacePlan,
	planWorkspaces,
	purgeOrphanedTrash,
} from "./account-workspaces.js";
import {
	markAccountDeleted,
	releaseDeletionLock,
	takeDeletionLock,
} from "./deleted-account-model.js";

function inProgress(): OperationError {
	return new OperationError(
		409,
		"ACCOUNT_DELETION_IN_PROGRESS",
		"This account is already being deleted; try again in a moment",
	);
}

/**
 * Deletes the account's Localman data once the account was deleted at the
 * IdP (docs/decisions/0012-account-deletion-at-the-idp.md), one deletion
 * per account at a time (a second one answers 409 in progress). Shared
 * assets go to someone else instead of blocking: team workspaces get an
 * Admin and a new owner, shared mock projects go to their earliest member.
 * Then every session, the projects nobody else uses, own rows,
 * anonymization, Tunelo links, and the user row last, after the hashed
 * tombstone. Every step is idempotent: a deletion that fails half way
 * leaves the user row, so running it again finishes it.
 */
export async function deleteAccount(sub: string): Promise<void> {
	if (!(await takeDeletionLock(sub))) throw inProgress();
	try {
		await deleteLocked(sub);
	} finally {
		await releaseDeletionLock(sub);
	}
}

async function deleteLocked(sub: string): Promise<void> {
	const user = await UserModel.findOne({ sub }, { _id: 1 }).lean<{
		_id: Types.ObjectId;
	}>();
	const plan = await planWorkspaces(sub);
	await applyWorkspacePlan(sub, plan);
	const counts: ErasedCount[] = [...(await revokeSessions(sub))];
	forgetKnownSubject(sub);
	const projects = await transferOrDeleteProjects(sub);
	const purgedTrash = await purgeOrphanedTrash(sub);
	counts.push(...(await deleteOwnRows(sub)));
	counts.push(...(await anonymizeReferences(sub)));
	counts.push(await revokeTunnelLinks(sub));
	await deleteOwnerLock(sub);
	await markAccountDeleted(sub);
	const removed = await UserModel.deleteOne({ sub });
	// Again after the row is gone: an MCP request in between would have
	// cached the subject as known for its TTL.
	forgetKnownSubject(sub);
	counts.push({ collection: "users", count: removed.deletedCount });
	// Internal ids and counts only: never the IdP subject (ADR 0018 of the IdP).
	accountDeletionLog().info(
		{
			userId: user?._id.toHexString() ?? null,
			projectsTransferred: projects.transferred,
			projectsDeleted: projects.deleted,
			workspacesDeleted: plan.toDelete.length,
			workspacesLeft: plan.toLeave.length,
			purgedTrash,
			counts: counts.filter((entry) => entry.count > 0),
		},
		"Account deleted",
	);
}
