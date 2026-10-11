import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import {
	type WorkspaceRole,
	workspaceRoleAllows,
} from "@localman/shared/access";
import type { StoredWorkspace } from "../workspaces/workspace-model.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel, type StoredCollection } from "./collection-model.js";

/**
 * Days a collection stays in the trash before the job deletes it for
 * good: the longest `trashDays` of any plan (30 for Free and Pro alike).
 * One value for every collection, so nothing is purged before its owner's
 * plan says, whichever plan that owner holds when the job runs.
 */
export const TRASH_RETENTION_DAYS = Math.max(
	limitsFor("free").trashDays,
	limitsFor("pro").trashDays,
);
const DAY_MS = 24 * 60 * 60 * 1000;

export const IN_TRASH = { deletedAt: { $exists: true } } as const;

export function purgeAtOf(deletedAt: Date): Date {
	return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS);
}

export interface TrashedCollection extends StoredCollection {
	readonly deletedAt: Date;
	readonly deletedBy: string;
}

export function notInTrash(): OperationError {
	return new OperationError(
		404,
		"NOT_FOUND",
		"Collection not found in the trash",
	);
}

export interface TrashAccess {
	readonly trashed: TrashedCollection;
	/** The workspace it was deleted from, `null` once that is deleted too. */
	readonly original: StoredWorkspace | null;
	/** The caller's current role there. */
	readonly originalRole: WorkspaceRole | null;
}

/**
 * The trashed collection if `sub` may restore or permanently delete it,
 * 404 otherwise (so nobody learns it exists). Rights follow the current
 * role: an Admin or Editor of its workspace now, whoever deleted it. Once
 * that workspace is deleted too, the person who deleted the collection
 * and the workspace's Admins and Editors at that moment (`trashEditors`).
 */
export async function requireTrashed(
	sub: string,
	id: string,
): Promise<TrashAccess> {
	const _id = toObjectId(id);
	const trashed = _id
		? await CollectionModel.findOne({
				_id,
				...IN_TRASH,
			}).lean<TrashedCollection>()
		: null;
	if (!trashed) throw notInTrash();
	const original = await findWorkspaceById(trashed.workspaceId.toHexString());
	if (!original) {
		const editors = trashed.trashEditors ?? [];
		if (trashed.deletedBy !== sub && !editors.includes(sub)) {
			throw notInTrash();
		}
		return { trashed, original, originalRole: null };
	}
	const originalRole = await workspaceRoleOf(sub, original);
	if (!workspaceRoleAllows(originalRole, "restoreElements")) throw notInTrash();
	return { trashed, original, originalRole };
}
