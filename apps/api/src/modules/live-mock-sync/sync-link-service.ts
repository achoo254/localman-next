import { OperationError } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import type { MergePreview } from "@localman/shared/api-client";
import mongoose, { type Types } from "mongoose";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
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
import { conflictsLeft } from "../version-control/fork-access.js";
import { mergePreview } from "../version-control/merge-views.js";
import type { MergeSide } from "../version-control/three-way-merge.js";
import { mockOriginOf } from "./sync-environment.js";
import {
	type StoredSyncLink,
	SyncLinkModel,
	deleteSyncLink,
} from "./sync-link-model.js";
import { computeSync, syncLink } from "./sync-service.js";

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
	 * The project secret changed since the environment got its baseUrl:
	 * the sync does not write the new one there (rotating cuts access).
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

interface LinkAccess {
	readonly access: CollectionAccess;
	readonly link: StoredSyncLink;
}

async function requireLink(
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

/** The live project and whether the caller edits it (`null`: gone). */
async function projectFor(
	sub: string,
	link: StoredSyncLink,
): Promise<{
	project: StoredProject;
	editor: boolean;
	reader: boolean;
} | null> {
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
		mockUrlChanged:
			found !== null &&
			mockOriginOf(link.baseUrl) !==
				mockOriginOf(mockBaseUrlOf(found.project.secret, found.project.prefix)),
	};
}

/**
 * Turns the sync off (Editors of the collection and of the project, or of
 * the collection alone once the project is gone): the collection becomes
 * an ordinary one and keeps its content.
 */
export async function stopSync(
	sub: string,
	collectionId: string,
): Promise<void> {
	const { link } = await requireLink(sub, collectionId, "edit");
	const found = await projectFor(sub, link);
	if (found !== null && !found.editor) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Editors of the mock project turn its sync off",
		);
	}
	await mongoose.connection.transaction((session) =>
		deleteSyncLink(link._id, session),
	);
}

/** What resolving would do: the conflicts and the changes (any role). */
export async function previewSync(
	sub: string,
	collectionId: string,
): Promise<MergePreview> {
	const { link } = await requireLink(sub, collectionId, "view");
	// Reads both sides whole, like a fork's preview: the same limit.
	await takeOperationSlot("sync", sub, collectionId);
	const computed = await computeSync(link);
	if (!computed) return { changes: [], conflicts: [] };
	const { views, conflicts } = computed.outcome;
	return mergePreview(
		{
			base: views.base,
			source: views.theirs,
			destination: views.collection,
			merged: views.merged,
		},
		conflicts,
	);
}

/**
 * Applies the mock's changes with a choice for every conflict (Editors of
 * the collection): `source` takes the mock's value, `destination` keeps
 * the collection's. 409 `MERGE_CONFLICTS` while one lacks a choice.
 */
export async function resolveSync(
	sub: string,
	collectionId: string,
	resolutions: Readonly<Record<string, MergeSide>>,
): Promise<SyncStatus> {
	const { link } = await requireLink(sub, collectionId, "edit");
	await takeOperationSlot("sync", sub, collectionId);
	const computed = await computeSync(link, resolutions);
	if (computed && computed.outcome.unresolved.length > 0) {
		throw conflictsLeft(computed.outcome.unresolved);
	}
	await syncLink(link._id, resolutions);
	return syncStatus(sub, collectionId);
}

export interface ProjectSyncedCollection {
	readonly collectionId: string;
	readonly name: string;
}

/** Collections synced with the project that the caller can open. */
export async function syncedCollectionsOf(
	sub: string,
	project: StoredProject,
): Promise<ProjectSyncedCollection[]> {
	const links = await SyncLinkModel.find(
		{ projectId: project._id },
		{ collectionId: 1 },
	).lean<{ collectionId: Types.ObjectId }[]>();
	const out: ProjectSyncedCollection[] = [];
	for (const link of links) {
		const id = link.collectionId.toHexString();
		const access = await requireCollection(sub, id, "view").catch(() => null);
		if (access) out.push({ collectionId: id, name: access.element.name });
	}
	return out;
}
