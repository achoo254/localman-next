import type {
	JsonObject,
	ResourceEndpoint,
	ResourceField,
} from "@localman/shared";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

const fieldSchema = new Schema(
	{
		name: { type: String, required: true },
		type: { type: String, required: true },
		fakerMethod: { type: String },
		childId: { type: String },
	},
	{ _id: false },
);

const endpointSchema = new Schema(
	{
		method: { type: String, required: true },
		path: { type: String, required: true },
		enabled: { type: Boolean, required: true },
		/** Any JSON, `null` included, so no `required` (it rejects null). */
		response: { type: Schema.Types.Mixed },
		/**
		 * `EndpointChaos` and `EndpointRule[]` (validated by
		 * `endpointInputSchema`). Endpoints stored before they existed lack
		 * them and run without chaos or rules.
		 */
		chaos: { type: Schema.Types.Mixed },
		rules: { type: Schema.Types.Mixed },
	},
	{ _id: false },
);

/**
 * A resource of a project, arranged as a tree through `parentId`. Sibling
 * names are unique (`(projectId, parentId, name)`, roots share `null`).
 *
 * - `count` mirrors the number of records; `nextId` is the id the next
 *   created record gets (ids are "1", "2", … like the source).
 * - `ownerSub` and `quotaSlot` bill the resource to the project owner: the
 *   unique `(ownerSub, quotaSlot)` index makes concurrent creates race on
 *   one slot instead of all passing the plan check (as for projects).
 * - `minimize: false` keeps `{}` values of templates and responses.
 */
const resourceSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		parentId: { type: Schema.Types.ObjectId, default: null },
		name: { type: String, required: true },
		/**
		 * Parent ID field of the records (`userId`), set when the resource is
		 * created or moved, `null` on a root. No default: resources stored
		 * before the field existed lack it and keep the key the old rule
		 * builds from the parent's name (`resourceParentKey`).
		 */
		parentKey: { type: String },
		schema: { type: [fieldSchema], default: [] },
		template: { type: Schema.Types.Mixed, default: null },
		endpoints: { type: [endpointSchema], default: [] },
		count: { type: Number, required: true, default: 0, min: 0 },
		nextId: { type: Number, required: true, default: 1, min: 1 },
		/**
		 * Sum of `recordBytes` of the records, kept by every write so the
		 * mock runtime checks `MAX_RESOURCE_BYTES` by delta instead of
		 * reading all records. No default: resources stored before the
		 * field existed lack it and are measured once on their next mock
		 * write (`storedDataBytes`).
		 */
		dataBytes: { type: Number, min: 0 },
		ownerSub: { type: String, required: true },
		quotaSlot: { type: Number, required: true, min: 0 },
		/** Bumped by every update; restarts the `nth` count of rules. */
		revision: { type: Number, default: 0, min: 0 },
	},
	{
		collection: "resources",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
resourceSchema.index({ projectId: 1, parentId: 1, name: 1 }, { unique: true });
resourceSchema.index({ ownerSub: 1, quotaSlot: 1 }, { unique: true });

resourceSchema.plugin(tenantScopePlugin);
export const ResourceModel = mongoose.model("Resource", resourceSchema);

export interface StoredResource {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly parentId: Types.ObjectId | null;
	readonly name: string;
	/** Absent on resources stored before the field existed. */
	readonly parentKey?: string | null;
	readonly schema: readonly ResourceField[];
	readonly template: JsonObject | null;
	readonly endpoints: readonly ResourceEndpoint[];
	readonly count: number;
	readonly nextId: number;
	/** Absent on resources stored before the field existed. */
	readonly dataBytes?: number;
	readonly ownerSub: string;
	readonly quotaSlot: number;
	/** Absent on resources stored before the field existed (revision 0). */
	readonly revision?: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
