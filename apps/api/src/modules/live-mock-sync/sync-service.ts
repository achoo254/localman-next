import type { ClientSession, Types } from "mongoose";
import {
	CollectionModel,
	LIVE_COLLECTION,
} from "../collections/collection-model.js";
import { writeCollectionState } from "../collections/collection-state-write.js";
import { newNodeId } from "../collections/collection-store.js";
import type { CollectionState } from "../collections/revision-patch.js";
import { loadState } from "../collections/revision-state.js";
import { sameContent } from "../version-control/three-way-merge.js";
import type { MergeSide } from "../version-control/three-way-merge.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { type MockSide, loadMockSide } from "./mock-side.js";
import { syncEnvironment } from "./sync-environment.js";
import { LIVE_MOCK_SYNC_AUTHOR } from "./sync-keys.js";
import {
	type StoredSyncLink,
	SyncLinkModel,
	loadSyncBase,
	saveSyncBase,
} from "./sync-link-model.js";
import { type SyncOutcome, mergeMockChanges } from "./sync-merge.js";

export type SyncResult =
	| { readonly status: "synced"; readonly outcome: SyncOutcome }
	/** The link, its collection or its project is gone (or in the trash). */
	| { readonly status: "skipped" };

async function workspaceOf(
	collectionId: Types.ObjectId,
): Promise<Types.ObjectId | null> {
	const root = await CollectionModel.findOne(
		{ _id: collectionId, ...LIVE_COLLECTION },
		{ workspaceId: 1 },
	).lean<{ workspaceId: Types.ObjectId }>();
	return root?.workspaceId ?? null;
}

export interface ComputedSync {
	readonly outcome: SyncOutcome;
	readonly side: MockSide;
	/** The collection the outcome was merged into. */
	readonly current: CollectionState;
}

/** The mock's changes merged into the collection, nothing written. */
export async function computeSync(
	link: StoredSyncLink,
	resolutions: Readonly<Record<string, MergeSide>> = {},
	session?: ClientSession,
): Promise<ComputedSync | null> {
	const side = await loadMockSide(link.projectId, link.names, session);
	if (!side) return null;
	const collection = await loadState(link.collectionId, session);
	const base = await loadSyncBase(link._id, session);
	const outcome = mergeMockChanges(
		{
			base,
			mapped: side.nodes,
			collection,
			pairs: link.pairs,
			names: link.names,
			resolutions,
		},
		newNodeId,
	);
	return { outcome, side, current: collection };
}

/**
 * Applies the mock's changes to the collection as one `sync` change by
 * Live Mock Sync (in the workspace's transaction, so edits and other syncs
 * wait their turn). Clashes left without a choice keep the collection's
 * value and the old base, so they show again until resolved; everything
 * else is applied. Writes nothing when nothing changed.
 */
export async function syncLink(
	linkId: Types.ObjectId,
	resolutions: Readonly<Record<string, MergeSide>> = {},
): Promise<SyncResult> {
	const first = await SyncLinkModel.findById(linkId).lean<StoredSyncLink>();
	if (!first) return { status: "skipped" };
	const workspaceId = await workspaceOf(first.collectionId);
	if (!workspaceId) return { status: "skipped" };
	return inWorkspaceTransaction(workspaceId, async (session) => {
		const link = await SyncLinkModel.findById(linkId)
			.session(session)
			.lean<StoredSyncLink>();
		if (!link) return { status: "skipped" } as const;
		const computed = await computeSync(link, resolutions, session);
		if (!computed) return { status: "skipped" } as const;
		const { outcome, side, current } = computed;
		const changed = !sameContent(current, outcome.target);
		if (changed) {
			await writeCollectionState(
				link.collectionId,
				LIVE_MOCK_SYNC_AUTHOR,
				session,
				{ current, target: outcome.target },
				{ action: "sync", entityName: side.project.name, dryRun: false },
			);
		}
		await syncEnvironment(
			link.environmentId,
			{ baseUrl: link.baseUrl, idVariables: link.idVariables },
			side.variables,
			session,
		);
		const settled = outcome.unresolved.length === 0;
		if (settled) await saveSyncBase(link._id, outcome.theirs, session);
		await SyncLinkModel.updateOne(
			{ _id: link._id },
			{
				$set: {
					pairs: outcome.pairs,
					baseUrl: side.variables.baseUrl,
					idVariables: [...side.variables.idVariables],
					lastSyncedAt: new Date(),
					conflicts: outcome.unresolved.length,
				},
				...(changed ? { $inc: { syncCount: 1 } } : {}),
			},
			{ session },
		);
		return { status: "synced", outcome } as const;
	});
}
