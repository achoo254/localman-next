/**
 * Who may take a collection outside its workspace, and whether what they
 * published may still be served. Both read the collection's current
 * workspace (no copy is stored), so moving a collection puts its links,
 * keys and buttons under the new workspace's switches and members.
 */
import { OperationError } from "@localman/operations";
import { workspaceRoleAllows } from "@localman/shared/access";
import type { WorkspaceSharingSwitch } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import {
	type CollectionAccess,
	requireCollection,
} from "../collections/collection-access.js";
import type { StoredWorkspace } from "../workspaces/workspace-model.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { sharingSettingsOf } from "./workspace-sharing.js";

interface InWorkspace {
	readonly workspaceId: Types.ObjectId;
}

/** A workspace member whose role publishes (Admin, Editor); shares do not count. */
async function publishesIn(
	sub: string,
	workspace: StoredWorkspace,
): Promise<boolean> {
	return workspaceRoleAllows(
		await workspaceRoleOf(sub, workspace),
		"publishPublic",
	);
}

export async function canPublish(
	sub: string,
	collection: InWorkspace,
): Promise<boolean> {
	const workspace = await findWorkspaceById(
		collection.workspaceId.toHexString(),
	);
	return workspace !== null && (await publishesIn(sub, workspace));
}

const SWITCH_ERRORS: Record<WorkspaceSharingSwitch, [string, string]> = {
	publicLinksAllowed: [
		"PUBLIC_LINKS_DISABLED",
		"An Admin turned public links off for this workspace",
	],
	guestsAllowed: [
		"GUESTS_DISABLED",
		"An Admin turned guest links off for this workspace",
	],
	accessKeysAllowed: [
		"ACCESS_KEYS_DISABLED",
		"An Admin turned access keys off for this workspace",
	],
};

/**
 * The live collection if `sub` may publish it with `toggle` on: 404 when
 * they cannot see it, 403 FORBIDDEN when they are not an Admin or Editor
 * member of its workspace, 403 with the switch's code when it is off
 * (`null`: turning something off, allowed whatever the switches say).
 */
export async function requirePublishable(
	sub: string,
	collectionId: string,
	toggle: WorkspaceSharingSwitch | null,
): Promise<CollectionAccess> {
	const access = await requireCollection(sub, collectionId, "view");
	const workspace = await findWorkspaceById(
		access.element.workspaceId.toHexString(),
	);
	if (!workspace || !(await publishesIn(sub, workspace))) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Admins and Editors of the workspace can share it outside",
		);
	}
	if (toggle !== null && !sharingSettingsOf(workspace)[toggle]) {
		const [code, message] = SWITCH_ERRORS[toggle];
		throw new OperationError(403, code, message);
	}
	return access;
}

/**
 * What `createdBy` published still goes out: the switch is on in the
 * collection's current workspace and they are still an Admin or Editor
 * member of it. Checked on every use, never cached.
 */
export async function stillServable(
	createdBy: string,
	collection: InWorkspace,
	toggle: WorkspaceSharingSwitch,
): Promise<boolean> {
	const workspace = await findWorkspaceById(
		collection.workspaceId.toHexString(),
	);
	if (!workspace || !sharingSettingsOf(workspace)[toggle]) return false;
	return publishesIn(createdBy, workspace);
}
