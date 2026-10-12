import { WORKSPACE_PERMISSIONS } from "@localman/shared/access";
import type { TrashList } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { displayNames } from "../users/display-names.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel } from "./collection-model.js";
import { escapeRegExp, foldSearchText } from "./search-text.js";
import { IN_TRASH, type TrashedCollection } from "./trash-access.js";
import { toTrashedViews } from "./trash-view.js";

/** Trashed collections one listing returns, newest first. */
export const TRASH_LIST_MAX = 500;

export interface TrashFilter {
	/** The workspace it was deleted from. */
	readonly workspaceId?: string;
	/** Who deleted it. */
	readonly deletedBy?: string;
	/** Part of its name, case and accents ignored. */
	readonly q?: string;
}

/** Workspaces where `sub` restores now: their own and those they edit. */
async function managedWorkspaceIds(sub: string): Promise<Types.ObjectId[]> {
	const [personal, memberships] = await Promise.all([
		WorkspaceModel.find({ ownerId: sub, type: "personal" }, { _id: 1 }).lean<
			{ _id: Types.ObjectId }[]
		>(),
		WorkspaceMemberModel.find(
			{
				userId: sub,
				status: "accepted",
				role: { $in: [...WORKSPACE_PERMISSIONS.restoreElements] },
			},
			{ workspaceId: 1 },
		).lean<{ workspaceId: Types.ObjectId }[]>(),
	]);
	return [
		...personal.map((row) => row._id),
		...memberships.map((row) => row.workspaceId),
	];
}

/**
 * The trash `sub` may restore from, as `requireTrashed` decides: deleted
 * collections of workspaces where they are Admin or Editor now, and of
 * deleted workspaces where they were (`trashEditors`) or that they
 * deleted the collection from; narrowed by `filter`. `deleters` lists who
 * deleted anything in that trash (narrowed by workspace only), for the
 * filter menu.
 */
export async function listTrash(
	sub: string,
	filter: TrashFilter,
): Promise<TrashList> {
	const narrowTo =
		filter.workspaceId === undefined
			? undefined
			: toObjectId(filter.workspaceId);
	if (narrowTo === null) return { items: [], deleters: [] };
	const base = {
		...IN_TRASH,
		...(narrowTo ? { workspaceId: narrowTo } : {}),
		$or: [
			{ workspaceId: { $in: await managedWorkspaceIds(sub) } },
			// `trashEditors` is only set once the workspace is deleted.
			{ trashEditors: sub },
			{ deletedBy: sub, trashEditors: { $exists: true } },
		],
	};
	const needle = filter.q === undefined ? "" : foldSearchText(filter.q.trim());
	const [rows, deleterIds] = await Promise.all([
		CollectionModel.find({
			...base,
			...(filter.deletedBy ? { deletedBy: filter.deletedBy } : {}),
			...(needle ? { searchName: { $regex: escapeRegExp(needle) } } : {}),
		})
			.sort({ deletedAt: -1, _id: -1 })
			.limit(TRASH_LIST_MAX)
			.lean<TrashedCollection[]>(),
		CollectionModel.distinct("deletedBy", base),
	]);
	const ids = deleterIds.filter((id): id is string => typeof id === "string");
	const names = await displayNames(ids);
	const deleters = ids
		.map((id) => ({ id, name: names.get(id) ?? null }))
		.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
	return { items: await toTrashedViews(rows), deleters };
}
