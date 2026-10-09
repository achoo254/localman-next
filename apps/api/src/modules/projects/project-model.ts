import mongoose, { Schema, type Types } from "mongoose";

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
		 */
		deletingAt: { type: Date, default: null },
	},
	{ collection: "projects", timestamps: true, versionKey: false },
);
projectSchema.index({ owner: 1, quotaSlot: 1 }, { unique: true });
projectSchema.index({ owner: 1, createdAt: 1 });

export const ProjectModel = mongoose.model("Project", projectSchema);

export interface StoredProject {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly prefix: string;
	readonly secret: string;
	readonly owner: string;
	readonly quotaSlot: number;
	readonly deletingAt?: Date | null;
	readonly createdAt: Date;
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
