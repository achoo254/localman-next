/** The Admin's public sharing switches of a workspace. */
import type { WorkspaceSharingSettings } from "@localman/shared/api-client";
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	type JsonRecord,
	expectBoolean,
	expectNumber,
	expectRecord,
} from "../../lib/json-guards";
import { workspacePath } from "../workspaces/workspaces-api";

/** What turning switches off stops at once (nothing is deleted). */
export interface SharingStopped {
	links: number;
	accessKeys: number;
	runButtons: number;
}

export interface UpdateSharingResult {
	dryRun: boolean;
	sharing: WorkspaceSharingSettings;
	stopped: SharingStopped;
}

function parseSettings(value: unknown): WorkspaceSharingSettings {
	const data: JsonRecord = expectRecord(value, "sharing");
	return {
		publicLinksAllowed: expectBoolean(data, "publicLinksAllowed"),
		guestsAllowed: expectBoolean(data, "guestsAllowed"),
		accessKeysAllowed: expectBoolean(data, "accessKeysAllowed"),
	};
}

export async function fetchWorkspaceSharing(
	workspaceId: string,
): Promise<WorkspaceSharingSettings> {
	return parseSettings(
		await apiRequest(`${workspacePath(workspaceId)}/sharing`),
	);
}

/** Omitted switches stay; with `dryRun`, only the counts. */
export async function updateWorkspaceSharing(
	workspaceId: string,
	changes: Partial<WorkspaceSharingSettings>,
	dryRun: boolean,
): Promise<UpdateSharingResult> {
	const data = expectRecord(
		await apiRequest(
			withDryRun(`${workspacePath(workspaceId)}/sharing`, dryRun),
			{ method: "PATCH", body: changes },
		),
		"sharing update",
	);
	const stopped = expectRecord(data.stopped, "stopped");
	return {
		dryRun: expectBoolean(data, "dryRun"),
		sharing: parseSettings(data.sharing),
		stopped: {
			links: expectNumber(stopped, "links"),
			accessKeys: expectNumber(stopped, "accessKeys"),
			runButtons: expectNumber(stopped, "runButtons"),
		},
	};
}
