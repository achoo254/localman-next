import type { CollectionNode } from "@localman/shared/api-client";
import mongoose, { type ClientSession, Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import type { MockNodes } from "./mock-to-collection-mapper.js";
import type { SyncPair } from "./sync-merge.js";
import type { SyncNames } from "./sync-names.js";

/**
 * A collection kept in sync with a mock project (one link per collection,
 * the collection it was made as; forks and copies are not linked). The
 * base, what the last sync took from the mock, sits in
 * `live_mock_sync_base_nodes` by mock key; `pairs` names the collection
 * node of each key. `conflicts` counts the clashes left open: until they
 * are resolved the base stays, so they come back on every sync.
 * `baseUrl` and `idVariables` are what the environment last got.
 */
const syncLinkSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		projectId: { type: Schema.Types.ObjectId, required: true },
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		environmentId: { type: Schema.Types.ObjectId, default: null },
		createdBy: { type: String, required: true },
		names: { type: Schema.Types.Mixed, required: true },
		pairs: { type: [{ k: String, n: String, _id: false }], default: [] },
		baseUrl: { type: String, required: true },
		idVariables: { type: [String], default: [] },
		syncCount: { type: Number, default: 0 },
		lastSyncedAt: { type: Date, required: true },
		conflicts: { type: Number, default: 0 },
	},
	{ collection: "live_mock_sync_links", timestamps: true, versionKey: false },
);
syncLinkSchema.index({ collectionId: 1 }, { unique: true });
syncLinkSchema.index({ projectId: 1 });

syncLinkSchema.plugin(tenantScopePlugin);
export const SyncLinkModel = mongoose.model("LiveMockSyncLink", syncLinkSchema);

export interface StoredSyncLink {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly workspaceId: Types.ObjectId;
	readonly environmentId: Types.ObjectId | null;
	readonly createdBy: string;
	readonly names: SyncNames;
	readonly pairs: readonly SyncPair[];
	readonly baseUrl: string;
	readonly idVariables: readonly string[];
	readonly syncCount: number;
	readonly lastSyncedAt: Date;
	readonly conflicts: number;
}

const syncBaseNodeSchema = new Schema(
	{
		linkId: { type: Schema.Types.ObjectId, required: true },
		key: { type: String, required: true },
		node: { type: Schema.Types.Mixed, required: true },
	},
	{ collection: "live_mock_sync_base_nodes", versionKey: false },
);
syncBaseNodeSchema.index({ linkId: 1, key: 1 }, { unique: true });

syncBaseNodeSchema.plugin(tenantScopePlugin);
export const SyncBaseNodeModel = mongoose.model(
	"LiveMockSyncBaseNode",
	syncBaseNodeSchema,
);

export async function loadSyncBase(
	linkId: Types.ObjectId,
	session?: ClientSession,
): Promise<MockNodes> {
	const rows = await SyncBaseNodeModel.find({ linkId })
		.session(session ?? null)
		.lean<{ key: string; node: CollectionNode }[]>();
	return Object.fromEntries(rows.map((row) => [row.key, row.node]));
}

export async function saveSyncBase(
	linkId: Types.ObjectId,
	base: MockNodes,
	session: ClientSession,
): Promise<void> {
	await SyncBaseNodeModel.deleteMany({ linkId }, { session });
	const docs = Object.entries(base).map(([key, node]) => ({
		linkId,
		key,
		node,
	}));
	if (docs.length > 0) await SyncBaseNodeModel.insertMany(docs, { session });
}

/** The link of a collection being deleted for good, if any, goes too. */
export async function dropSyncLinkOf(
	collectionId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	const link = await SyncLinkModel.findOne({ collectionId }, { _id: 1 })
		.session(session)
		.lean<{ _id: Types.ObjectId }>();
	if (link) await deleteSyncLink(link._id, session);
}

/** Drops the link and its base (the collection stays as it is). */
export async function deleteSyncLink(
	linkId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	await SyncBaseNodeModel.deleteMany({ linkId }, { session });
	await SyncLinkModel.deleteOne({ _id: linkId }, { session });
}
