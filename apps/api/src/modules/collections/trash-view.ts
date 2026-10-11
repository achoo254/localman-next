import type { Types } from "mongoose";
import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { type TrashedCollection, purgeAtOf } from "./trash-access.js";

export const trashedView = z.object({
	id: z.string(),
	name: z.string(),
	/** The workspace it was deleted from. */
	workspaceId: z.string(),
	/** `null` once that workspace is gone too (restore picks another). */
	workspaceName: z.string().nullable(),
	/** Requests it holds (what the delete dialog of the trash shows). */
	requestCount: z.number().int(),
	deletedAt: z.string(),
	deletedBy: z.string(),
	/** Name (else username) of who deleted it; `null` for a removed account. */
	deletedByName: z.string().nullable(),
	purgeAt: z.string(),
});
export type TrashedView = z.infer<typeof trashedView>;

/** Trash rows with their workspace and deleter names, in the same order. */
export async function toTrashedViews(
	rows: readonly TrashedCollection[],
): Promise<TrashedView[]> {
	const workspaceIds = [
		...new Set(rows.map((row) => row.workspaceId.toHexString())),
	];
	const deleters = [...new Set(rows.map((row) => row.deletedBy))];
	const [workspaces, users] = await Promise.all([
		WorkspaceModel.find({ _id: { $in: workspaceIds } }, { name: 1 }).lean<
			{ _id: Types.ObjectId; name: string }[]
		>(),
		UserModel.find(
			{ sub: { $in: deleters } },
			{ sub: 1, username: 1, name: 1 },
		).lean<{ sub: string; username: string; name?: string | null }[]>(),
	]);
	const workspaceNames = new Map(
		workspaces.map((ws) => [ws._id.toHexString(), ws.name]),
	);
	const userNames = new Map(
		users.map((user) => [user.sub, user.name || user.username]),
	);
	return rows.map((row) => ({
		id: row._id.toHexString(),
		name: row.name,
		workspaceId: row.workspaceId.toHexString(),
		workspaceName: workspaceNames.get(row.workspaceId.toHexString()) ?? null,
		requestCount: row.requestCount ?? 0,
		deletedAt: row.deletedAt.toISOString(),
		deletedBy: row.deletedBy,
		deletedByName: userNames.get(row.deletedBy) ?? null,
		purgeAt: purgeAtOf(row.deletedAt).toISOString(),
	}));
}
