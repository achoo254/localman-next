import type { TrashedCollectionSummary } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { z } from "zod";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { statusView, tagsView } from "./collection-view.js";
import { displayNames } from "./people.js";
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
	tags: tagsView,
	status: statusView,
	deletedAt: z.string(),
	deletedBy: z.string(),
	/** Name (else username) of who deleted it; `null` for a removed account. */
	deletedByName: z.string().nullable(),
	purgeAt: z.string(),
});

export const trashListView = z.object({
	items: z.array(trashedView),
	deleters: z.array(z.object({ id: z.string(), name: z.string().nullable() })),
});

/** Trash rows with their workspace and deleter names, in the same order. */
export async function toTrashedViews(
	rows: readonly TrashedCollection[],
): Promise<TrashedCollectionSummary[]> {
	const workspaceIds = [
		...new Set(rows.map((row) => row.workspaceId.toHexString())),
	];
	const [workspaces, names] = await Promise.all([
		WorkspaceModel.find({ _id: { $in: workspaceIds } }, { name: 1 }).lean<
			{ _id: Types.ObjectId; name: string }[]
		>(),
		displayNames(rows.map((row) => row.deletedBy)),
	]);
	const workspaceNames = new Map(
		workspaces.map((ws) => [ws._id.toHexString(), ws.name]),
	);
	return rows.map((row) => ({
		id: row._id.toHexString(),
		name: row.name,
		workspaceId: row.workspaceId.toHexString(),
		workspaceName: workspaceNames.get(row.workspaceId.toHexString()) ?? null,
		requestCount: row.requestCount ?? 0,
		tags: [...(row.tags ?? [])],
		status: row.status ?? null,
		deletedAt: row.deletedAt.toISOString(),
		deletedBy: row.deletedBy,
		deletedByName: names.get(row.deletedBy) ?? null,
		purgeAt: purgeAtOf(row.deletedAt).toISOString(),
	}));
}
