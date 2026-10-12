import { OperationError } from "@localman/operations";
import {
	type ElementRole,
	elementRoleFromWorkspace,
	strongerElementRole,
} from "@localman/shared/access";
import type {
	CollectionStatus,
	CollectionSummary,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { ElementRoleModel } from "../access/element-role-model.js";
import { collectSharedElements } from "../access/shared-elements.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { CollectionFavoriteModel } from "./collection-favorite-model.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import { COLLECTIONS_PER_WORKSPACE_MAX } from "./collection-store.js";

export interface ListedRoot {
	_id: Types.ObjectId;
	workspaceId: Types.ObjectId;
	name: string;
	requestCount?: number;
	tags?: string[];
	status?: CollectionStatus | null;
	updatedAt: Date;
}

const PROJECTION = {
	workspaceId: 1,
	name: 1,
	requestCount: 1,
	tags: 1,
	status: 1,
	updatedAt: 1,
};

function workspaceNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Workspace not found");
}

/** The live collections of the workspace shared with `sub`. */
function sharedRoots(
	sub: string,
	workspaceId: Types.ObjectId,
): Promise<ListedRoot[]> {
	return collectSharedElements(
		sub,
		"collection",
		COLLECTIONS_PER_WORKSPACE_MAX,
		(elementIds) => {
			const ids = elementIds.flatMap((id) => toObjectId(id) ?? []);
			return CollectionModel.find(
				{ _id: { $in: ids }, workspaceId, ...LIVE_COLLECTION },
				PROJECTION,
			).lean<ListedRoot[]>();
		},
	);
}

export interface VisibleRoots {
	readonly roots: ListedRoot[];
	/** What the caller's workspace role gives on every collection there. */
	readonly fromWorkspace: ElementRole | null;
}

/**
 * The collections of the workspace `sub` may open: every live one for a
 * member, only those shared with them otherwise (404 when there are none,
 * so a workspace's existence never leaks).
 */
export async function visibleRoots(
	sub: string,
	workspaceId: string,
): Promise<VisibleRoots> {
	const workspace = await findWorkspaceById(workspaceId);
	if (!workspace) throw workspaceNotFound();
	const fromWorkspace = elementRoleFromWorkspace(
		await workspaceRoleOf(sub, workspace),
	);
	if (fromWorkspace) {
		const roots = await CollectionModel.find(
			{ workspaceId: workspace._id, ...LIVE_COLLECTION },
			PROJECTION,
		)
			.limit(COLLECTIONS_PER_WORKSPACE_MAX)
			.lean<ListedRoot[]>();
		return { roots, fromWorkspace };
	}
	const roots = await sharedRoots(sub, workspace._id);
	if (roots.length === 0) throw workspaceNotFound();
	return { roots, fromWorkspace };
}

/**
 * The caller's role on each listed collection: the stronger of the
 * workspace's and their own share, as `elementRoleOf` decides (a share
 * still addressed to their email counts once they open the collection).
 */
async function rolesOf(
	sub: string,
	{ roots, fromWorkspace }: VisibleRoots,
): Promise<Map<string, ElementRole>> {
	const shares = await ElementRoleModel.find(
		{
			elementType: "collection",
			elementId: { $in: roots.map((root) => root._id.toHexString()) },
			userId: sub,
		},
		{ elementId: 1, role: 1 },
	).lean<{ elementId: string; role: ElementRole }[]>();
	const shared = new Map(shares.map((row) => [row.elementId, row.role]));
	const roles = new Map<string, ElementRole>();
	for (const root of roots) {
		const id = root._id.toHexString();
		const role = strongerElementRole(fromWorkspace, shared.get(id) ?? null);
		if (role) roles.set(id, role);
	}
	return roles;
}

/**
 * The sidebar list of a workspace with the caller's role on each: their
 * favorites first, then by name (case-insensitive). Counts come from the
 * root, which every node write keeps current.
 */
export async function listCollections(
	sub: string,
	workspaceId: string,
): Promise<CollectionSummary[]> {
	const visible = await visibleRoots(sub, workspaceId);
	const [roles, favorites] = await Promise.all([
		rolesOf(sub, visible),
		CollectionFavoriteModel.find(
			{
				userId: sub,
				collectionId: { $in: visible.roots.map((root) => root._id) },
			},
			{ collectionId: 1 },
		).lean<{ collectionId: Types.ObjectId }[]>(),
	]);
	const starred = new Set(
		favorites.map((row) => row.collectionId.toHexString()),
	);
	const summaries = visible.roots.flatMap((root): CollectionSummary[] => {
		const id = root._id.toHexString();
		const role = roles.get(id);
		if (!role) return [];
		return [
			{
				id,
				workspaceId: root.workspaceId.toHexString(),
				role,
				name: root.name,
				favorite: starred.has(id),
				requestCount: root.requestCount ?? 0,
				tags: root.tags ?? [],
				status: root.status ?? null,
				updatedAt: root.updatedAt.toISOString(),
			},
		];
	});
	return summaries.sort(
		(a, b) =>
			Number(b.favorite) - Number(a.favorite) ||
			a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
			(a.id < b.id ? -1 : 1),
	);
}
