/**
 * The Admin's switches of public sharing in one workspace. All on until an
 * Admin turns one off; a workspace saved before they existed reads as on.
 * Turning one off stops what it covers at once, since links, keys and
 * buttons check it each time they are used (`stillServable`).
 */
import {
	WORKSPACE_SHARING_SWITCHES,
	type WorkspaceSharingSettings,
} from "@localman/shared/api-client";
import {
	type StoredWorkspace,
	WorkspaceModel,
} from "../workspaces/workspace-model.js";
import { countServedBySwitch } from "./sharing-counts.js";

export function sharingSettingsOf(
	workspace: Pick<StoredWorkspace, "sharing">,
): WorkspaceSharingSettings {
	const stored = workspace.sharing ?? {};
	return {
		publicLinksAllowed: stored.publicLinksAllowed !== false,
		guestsAllowed: stored.guestsAllowed !== false,
		accessKeysAllowed: stored.accessKeysAllowed !== false,
	};
}

export interface SharingUpdate {
	readonly dryRun: boolean;
	readonly sharing: WorkspaceSharingSettings;
	/** Links, keys and buttons that stop because a switch goes off. */
	readonly stopped: {
		readonly links: number;
		readonly accessKeys: number;
		readonly runButtons: number;
	};
}

/** Applies `patch` (omitted switches stay); the dry run only counts. */
export async function updateWorkspaceSharing(
	workspace: StoredWorkspace,
	patch: Partial<WorkspaceSharingSettings>,
	dryRun: boolean,
): Promise<SharingUpdate> {
	const before = sharingSettingsOf(workspace);
	const sharing = { ...before, ...patch };
	const turnedOff = WORKSPACE_SHARING_SWITCHES.filter(
		(name) => before[name] && !sharing[name],
	);
	const stopped = await countServedBySwitch(workspace._id, turnedOff);
	// Field by field: two Admins switching different things at once must
	// not write back each other's old value.
	const set = Object.fromEntries(
		Object.entries(patch).map(([name, value]) => [`sharing.${name}`, value]),
	);
	if (!dryRun && Object.keys(set).length > 0) {
		await WorkspaceModel.updateOne({ _id: workspace._id }, { $set: set });
	}
	return { dryRun, sharing, stopped };
}
