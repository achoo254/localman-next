import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A mock project. `secret` is the public subdomain of its mock runtime
 * (`{secret}.localman.hoandat.com`), so it is unique and unguessable.
 * `quotaSlot` numbers the owner's projects from 0: together with the
 * unique `(owner, quotaSlot)` index it makes concurrent creates race on
 * the same slot instead of all passing the plan check (see project-service).
 */
const projectSchema = new Schema(
	{
		name: { type: String, required: true },
		prefix: { type: String, default: "" },
		secret: { type: String, required: true, unique: true },
		/** IdP `sub` of the owner. */
		owner: { type: String, required: true },
		quotaSlot: { type: Number, required: true, min: 0 },
		/**
		 * Tombstone: set when deletion starts, before dependents are
		 * cleaned up. A project with it is gone for every read and write
		 * except a repeated DELETE, which resumes the cleanup; the document
		 * (and its quota slot) goes last. Groundwork for a 30-day trash.
		 * No default: live projects leave it out (`LIVE_PROJECT` matches an
		 * absent field), so the partial index below holds only tombstones.
		 */
		deletingAt: { type: Date },
		/**
		 * Mock runtime activity, added in batches by `recordProjectRequests`
		 * (every few seconds, never per request). `null`: no request yet.
		 */
		lastRequestAt: { type: Date, default: null },
		mockRequests: { type: Number, default: 0 },
		/**
		 * Hybrid mock: where requests that match no resource or enabled
		 * endpoint go (`kind`: `tunnel` with `port`, `url` with `baseUrl`).
		 * Absent means none. Validated by the traffic operations.
		 */
		upstream: {
			type: new Schema(
				{
					kind: { type: String, enum: ["tunnel", "url"], required: true },
					port: { type: Number },
					baseUrl: { type: String },
				},
				{ _id: false },
			),
			default: undefined,
		},
		/** Header names (lowercase) masked in the request log, on top of the defaults. */
		redactHeaders: { type: [String], default: undefined },
	},
	{ collection: "projects", timestamps: true, versionKey: false },
);
projectSchema.index({ owner: 1, quotaSlot: 1 }, { unique: true });
projectSchema.index({ owner: 1, createdAt: 1 });
/** Tombstone sweeper (`deletingAt < before`, oldest first). */
projectSchema.index(
	{ deletingAt: 1 },
	{ partialFilterExpression: { deletingAt: { $exists: true } } },
);

projectSchema.plugin(tenantScopePlugin);
export const ProjectModel = mongoose.model("Project", projectSchema);

/** `upstream` as stored; read through `upstreamOf` (mock runtime). */
export interface StoredUpstream {
	readonly kind: string;
	readonly port?: number | null;
	readonly baseUrl?: string | null;
}

export interface StoredProject {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly prefix: string;
	readonly secret: string;
	readonly owner: string;
	readonly quotaSlot: number;
	readonly deletingAt?: Date | null;
	readonly lastRequestAt?: Date | null;
	readonly mockRequests?: number;
	readonly upstream?: StoredUpstream | null;
	readonly redactHeaders?: readonly string[];
	readonly createdAt: Date;
	/** Last edit of the project document (traffic does not count). */
	readonly updatedAt?: Date;
}

/** Matches projects that are not being deleted (absent field included). */
export const LIVE_PROJECT = { deletingAt: null } as const;

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Loads a project by id; a malformed id is simply not found, and so is a
 * project being deleted unless `includeDeleting` (only DELETE resumes).
 */
export async function findProjectById(
	id: string,
	includeDeleting = false,
): Promise<StoredProject | null> {
	if (!OBJECT_ID.test(id)) return null;
	const filter = includeDeleting ? { _id: id } : { _id: id, ...LIVE_PROJECT };
	return ProjectModel.findOne(filter).lean<StoredProject>();
}

/** Mock requests a process counted for one project since its last flush. */
export interface ProjectRequests {
	readonly projectId: string;
	readonly count: number;
	readonly lastAt: Date;
}

/**
 * Adds counted mock requests to their projects in one bulk write. Only
 * live projects are touched (never re-creating a deleted one), and
 * `updatedAt` stays as it is: traffic is not an edit of the project.
 */
export async function recordProjectRequests(
	batch: readonly ProjectRequests[],
): Promise<void> {
	if (batch.length === 0) return;
	await ProjectModel.bulkWrite(
		batch.map(({ projectId, count, lastAt }) => ({
			updateOne: {
				filter: { _id: projectId, ...LIVE_PROJECT },
				update: {
					$inc: { mockRequests: count },
					$max: { lastRequestAt: lastAt },
				},
				timestamps: false,
			},
		})),
		{ ordered: false },
	);
}
