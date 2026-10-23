import { OperationError } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import {
	type CollectionAccess,
	requireCollection,
} from "../collections/collection-access.js";
import { roleAllows, roleIn } from "../projects/project-access.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "../projects/project-model.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import { environmentBaseUrl, mockOriginOf } from "./sync-environment.js";
import { type StoredSyncLink, SyncLinkModel } from "./sync-link-model.js";

export interface SyncStatus {
	readonly collectionId: string;
	/** `null` when the project is gone or the caller cannot read it. */
	readonly project: { readonly id: string; readonly name: string } | null;
	readonly environmentId: string | null;
	readonly lastSyncedAt: string;
	readonly syncCount: number;
	/** Clashes waiting for a choice. */
	readonly conflicts: number;
	/** Editors of both the collection and the project turn it off. */
	readonly canManage: boolean;
	/** Editors of the collection choose for conflicts. */
	readonly canResolve: boolean;
	/**
	 * The environment's baseUrl still holds the mock URL from before the
	 * project secret changed: the sync never writes the new secret there
	 * (rotating cuts access), so an Editor updates it by hand.
	 */
	readonly mockUrlChanged: boolean;
}

function notSynced(): OperationError {
	return new OperationError(
		404,
		"NOT_SYNCED",
		"This collection is not synced with a mock project",
	);
}

export interface LinkAccess {
	readonly access: CollectionAccess;
	readonly link: StoredSyncLink;
}

export async function requireLink(
	sub: string,
	collectionId: string,
	action: "view" | "edit",
): Promise<LinkAccess> {
	const access = await requireCollection(sub, collectionId, action);
	const link = await SyncLinkModel.findOne({
		collectionId: access.collectionId,
	}).lean<StoredSyncLink>();
	if (!link) throw notSynced();
	return { access, link };
}

export interface ProjectRole {
	readonly project: StoredProject;
	readonly editor: boolean;
	readonly reader: boolean;
}

/** The live project and whether the caller edits it (`null`: gone). */
export async function projectFor(
	sub: string,
	link: StoredSyncLink,
): Promise<ProjectRole | null> {
	const project = await ProjectModel.findOne({
		_id: link.projectId,
		...LIVE_PROJECT,
	}).lean<StoredProject>();
	if (!project) return null;
	const role = await roleIn({ sub }, project);
	return {
		project,
		editor: roleAllows(role, "editResources"),
		reader: roleAllows(role, "read"),
	};
}

/** The environment still points at the mock with its old secret. */
async function urlStale(
	link: StoredSyncLink,
	project: StoredProject,
): Promise<boolean> {
	const value = await environmentBaseUrl(link.environmentId);
	if (value === null) return false;
	const now = mockOriginOf(mockBaseUrlOf(project.secret, project.prefix));
	const held = mockOriginOf(value);
	return held !== now && held === mockOriginOf(link.baseUrl);
}

export async function syncStatus(
	sub: string,
	collectionId: string,
): Promise<SyncStatus> {
	const { access, link } = await requireLink(sub, collectionId, "view");
	const found = await projectFor(sub, link);
	const collectionEditor = elementRoleAllows("collection", access.role, "edit");
	return {
		collectionId: access.collectionId.toHexString(),
		project:
			found?.reader === true
				? { id: found.project._id.toHexString(), name: found.project.name }
				: null,
		environmentId: link.environmentId?.toHexString() ?? null,
		lastSyncedAt: link.lastSyncedAt.toISOString(),
		syncCount: link.syncCount,
		conflicts: link.conflicts,
		// A gone project leaves the choice to the collection's Editors.
		canManage: collectionEditor && (found === null || found.editor),
		canResolve: collectionEditor,
		mockUrlChanged: found !== null && (await urlStale(link, found.project)),
	};
}
