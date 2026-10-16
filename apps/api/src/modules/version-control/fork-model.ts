import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

export const FORK_KINDS = ["collection", "environment"] as const;
export type ForkKind = (typeof FORK_KINDS)[number];

/** A source node id and the fork node id that stands for it. */
export interface IdPair {
	readonly s: string;
	readonly f: string;
}

/**
 * The link between a fork and its source (a collection or an
 * environment), with the common ancestor merges compare against: the
 * collection's base root here and its base nodes in `fork_base_nodes`, an
 * environment's whole base here. The base is the content both sides agree
 * on, replaced after every pull and merge. `pairs` matches collection
 * nodes across the two sides, since a fork's nodes have their own ids.
 */
const forkSchema = new Schema(
	{
		kind: { type: String, enum: FORK_KINDS, required: true },
		sourceId: { type: Schema.Types.ObjectId, required: true },
		forkId: { type: Schema.Types.ObjectId, required: true },
		label: { type: String, required: true },
		createdBy: { type: String, required: true },
		pairs: {
			type: [{ s: String, f: String, _id: false }],
			default: [],
		},
		base: { type: Schema.Types.Mixed, required: true },
	},
	{ collection: "forks", timestamps: true, versionKey: false },
);
forkSchema.index({ forkId: 1 }, { unique: true });
forkSchema.index({ sourceId: 1, createdAt: -1 });

forkSchema.plugin(tenantScopePlugin);
export const ForkModel = mongoose.model("Fork", forkSchema);

export interface StoredFork {
	readonly _id: Types.ObjectId;
	readonly kind: ForkKind;
	readonly sourceId: Types.ObjectId;
	readonly forkId: Types.ObjectId;
	readonly label: string;
	readonly createdBy: string;
	readonly pairs: readonly IdPair[];
	readonly base: unknown;
	readonly createdAt: Date;
}

/**
 * One node of a collection fork's base, keyed by its source node id (or
 * by the fork node id for a node the source never had).
 */
const forkBaseNodeSchema = new Schema(
	{
		linkId: { type: Schema.Types.ObjectId, required: true },
		key: { type: String, required: true },
		node: { type: Schema.Types.Mixed, required: true },
	},
	{ collection: "fork_base_nodes", versionKey: false },
);
forkBaseNodeSchema.index({ linkId: 1, key: 1 }, { unique: true });

forkBaseNodeSchema.plugin(tenantScopePlugin);
export const ForkBaseNodeModel = mongoose.model(
	"ForkBaseNode",
	forkBaseNodeSchema,
);
