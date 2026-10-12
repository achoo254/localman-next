import type {
	CollectionStatus,
	EffectiveAuth,
	RequestScripts,
	VariableEntry,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * The root of a collection: its workspace, Markdown description and what
 * its folders and requests inherit (auth, scripts, variables). `auth`,
 * `scripts` and `variables` passed the shared zod schemas when written.
 * Deleting moves it to the trash (`deletedAt`, `deletedBy`); the trash
 * job removes it and its nodes for good after `trashDays`. Every node
 * write also updates the root in the same transaction: `bytes` (JSON size
 * of the root's and nodes' content, capped per collection),
 * `requestCount` (the sidebar's count) and `updatedAt`.
 *
 * Links (`collection-links.ts`), outside the changelog: the mock project
 * it was created from, the environment an Editor linked (`null` once they
 * chose none) and the environment last shared together with it. Views
 * resolve them per caller and skip what is gone or unreadable.
 */
const collectionSchema = new Schema(
	{
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		name: { type: String, required: true },
		description: { type: String, default: "" },
		auth: { type: Schema.Types.Mixed, required: true },
		scripts: { type: Schema.Types.Mixed, required: true },
		variables: { type: Schema.Types.Mixed, required: true },
		createdBy: { type: String, required: true },
		updatedBy: { type: String, required: true },
		bytes: { type: Number, default: 0 },
		requestCount: { type: Number, default: 0 },
		tags: { type: [String], default: [] },
		status: { type: Schema.Types.Mixed, default: null },
		mockProjectId: { type: Schema.Types.ObjectId },
		/** No default: absent means no Editor chose yet, `null` chose none. */
		linkedEnvironmentId: { type: Schema.Types.ObjectId },
		sharedEnvironmentId: { type: Schema.Types.ObjectId },
		/** `name` folded for search (`foldSearchText`). */
		searchName: { type: String },
		/** Last revision number, and what the changelog holds (trimmed). */
		revisionSeq: { type: Number, default: 0 },
		revisionCount: { type: Number, default: 0 },
		revisionBytes: { type: Number, default: 0 },
		deletedAt: { type: Date },
		deletedBy: { type: String },
		/**
		 * Set when its workspace is deleted: the Admins and Editors it had
		 * then, who keep the right to restore or purge it.
		 */
		trashEditors: { type: [String], default: undefined },
	},
	{
		collection: "collections",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
// A workspace's live collections (the sidebar: `deletedAt` missing) and its
// trash (newest first). Partial indexes cannot select a missing field, so
// one plain index serves both.
collectionSchema.index({ workspaceId: 1, deletedAt: -1, name: 1 });
// Trashed collections by age (the purge job) and by who deleted them.
collectionSchema.index(
	{ deletedAt: 1 },
	{ partialFilterExpression: { deletedAt: { $exists: true } } },
);
collectionSchema.index(
	{ deletedBy: 1, deletedAt: -1 },
	{ partialFilterExpression: { deletedAt: { $exists: true } } },
);
collectionSchema.index(
	{ trashEditors: 1, deletedAt: -1 },
	{ partialFilterExpression: { deletedAt: { $exists: true } } },
);

export const CollectionModel = mongoose.model("Collection", collectionSchema);

/** Filter of collections not in the trash. */
export const LIVE_COLLECTION = { deletedAt: { $exists: false } } as const;

export interface StoredCollection {
	readonly _id: Types.ObjectId;
	readonly workspaceId: Types.ObjectId;
	readonly name: string;
	readonly description: string;
	readonly auth: EffectiveAuth;
	readonly scripts: RequestScripts;
	readonly variables: VariableEntry[];
	readonly createdBy: string;
	readonly updatedBy: string;
	/** Missing on a record written before it existed: read as 0. */
	readonly bytes?: number;
	readonly requestCount?: number;
	readonly tags?: readonly string[];
	readonly status?: CollectionStatus | null;
	readonly mockProjectId?: Types.ObjectId | null;
	readonly linkedEnvironmentId?: Types.ObjectId | null;
	readonly sharedEnvironmentId?: Types.ObjectId | null;
	readonly revisionSeq?: number;
	readonly revisionCount?: number;
	readonly revisionBytes?: number;
	readonly deletedAt?: Date | null;
	readonly deletedBy?: string | null;
	readonly trashEditors?: readonly string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
