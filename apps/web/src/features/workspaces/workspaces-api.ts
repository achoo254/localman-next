import {
	WORKSPACE_ROLES,
	WORKSPACE_TYPES,
	type WorkspaceRole,
	type WorkspaceType,
} from "@localman/shared/access";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** A workspace as the signed-in user sees it (`sharing.listWorkspaces`). */
export interface Workspace {
	id: string;
	name: string;
	description: string | null;
	type: WorkspaceType;
	/** The caller's role in the workspace. */
	role: WorkspaceRole;
	/** Accepted members; 1 for a personal workspace. */
	memberCount: number;
}

export const workspacePath = (workspaceId: string): string =>
	`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;

export function parseRole(value: unknown, what: string): WorkspaceRole {
	const role = WORKSPACE_ROLES.find((r) => r === value);
	if (!role) throw new InvalidResponseError(what);
	return role;
}

export function parseWorkspace(value: unknown): Workspace {
	const data: JsonRecord = expectRecord(value, "workspace");
	const type = WORKSPACE_TYPES.find((t) => t === data.type);
	if (!type) throw new InvalidResponseError("workspace type");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		description: optionalString(data, "description"),
		type,
		role: parseRole(data.role, "workspace role"),
		memberCount: expectNumber(data, "memberCount"),
	};
}

/** Personal workspace first, then the team workspaces the caller belongs to. */
export async function fetchWorkspaces(): Promise<Workspace[]> {
	const data = expectRecord(
		await apiRequest("/api/v1/workspaces"),
		"workspace list",
	);
	return expectArray(data, "items").map(parseWorkspace);
}

export interface WorkspaceDetails {
	name: string;
	/** Empty clears the description. */
	description: string;
}

export async function createWorkspace(
	details: WorkspaceDetails,
): Promise<Workspace> {
	const description = details.description.trim();
	return parseWorkspace(
		await apiRequest("/api/v1/workspaces", {
			method: "POST",
			body: {
				name: details.name.trim(),
				...(description ? { description } : {}),
			},
		}),
	);
}

export async function updateWorkspace(
	workspaceId: string,
	details: WorkspaceDetails,
): Promise<Workspace> {
	const description = details.description.trim();
	return parseWorkspace(
		await apiRequest(workspacePath(workspaceId), {
			method: "PATCH",
			body: { name: details.name.trim(), description: description || null },
		}),
	);
}

/** Deletes a team workspace with its members and pending invitations. */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
	await apiRequest(workspacePath(workspaceId), { method: "DELETE" });
}
