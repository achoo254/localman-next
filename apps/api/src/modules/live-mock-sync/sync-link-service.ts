import { OperationError } from "@localman/operations";
import type { MergePreview } from "@localman/shared/api-client";
import mongoose, { type Types } from "mongoose";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireCollection } from "../collections/collection-access.js";
import type { StoredProject } from "../projects/project-model.js";
import { conflictsLeft } from "../version-control/fork-access.js";
import { mergePreview } from "../version-control/merge-views.js";
import type { MergeSide } from "../version-control/three-way-merge.js";
import { SyncLinkModel, deleteSyncLink } from "./sync-link-model.js";
import { computeSync, syncLink } from "./sync-service.js";
import {
	type SyncStatus,
	projectFor,
	requireLink,
	syncStatus,
} from "./sync-status.js";

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
