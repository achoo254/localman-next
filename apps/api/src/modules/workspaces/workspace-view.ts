import {
	WORKSPACE_ROLES,
	WORKSPACE_TYPES,
	WORKSPACE_VISIBILITIES,
	type WorkspaceRole,
} from "@localman/shared/access";
import type { Types } from "mongoose";
import { z } from "zod";
import { WorkspaceMemberModel } from "./workspace-member-model.js";
import type { StoredWorkspace } from "./workspace-model.js";

export const workspaceView = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	type: z.enum(WORKSPACE_TYPES),
	visibility: z.enum(WORKSPACE_VISIBILITIES),
	/** The caller's role in the workspace. */
	role: z.enum(WORKSPACE_ROLES),
	/** Accepted members; 1 for a personal workspace (its owner). */
	memberCount: z.number().int(),
});
export type WorkspaceView = z.infer<typeof workspaceView>;

/** Accepted members per team workspace, in one aggregation. */
export async function memberCounts(
	workspaceIds: readonly Types.ObjectId[],
): Promise<Map<string, number>> {
	const rows = await WorkspaceMemberModel.aggregate<{
		_id: Types.ObjectId;
		count: number;
	}>([
		{ $match: { workspaceId: { $in: [...workspaceIds] }, status: "accepted" } },
		{ $group: { _id: "$workspaceId", count: { $sum: 1 } } },
	]);
	return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
}

export function toWorkspaceView(
	workspace: StoredWorkspace,
	role: WorkspaceRole,
	counts: ReadonlyMap<string, number>,
): WorkspaceView {
	const id = workspace._id.toHexString();
	return {
		id,
		name: workspace.name,
		description: workspace.description ?? null,
		type: workspace.type,
		visibility: workspace.visibility,
		role,
		memberCount: workspace.type === "personal" ? 1 : (counts.get(id) ?? 0),
	};
}

/** One workspace's view, its member count read on the spot. */
export async function viewOfWorkspace(
	workspace: StoredWorkspace,
	role: WorkspaceRole,
): Promise<WorkspaceView> {
	const counts =
		workspace.type === "team"
			? await memberCounts([workspace._id])
			: new Map<string, number>();
	return toWorkspaceView(workspace, role, counts);
}
