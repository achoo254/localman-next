import type {
	ChangelogAction,
	ChangelogEntity,
	ChangelogEntityKind,
} from "@localman/shared/api-client";
import type { Operation } from "fast-json-patch";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * One change of a collection, written in the transaction of the change:
 * who, when, what (entity, action, changed fields) and two JSON Patches
 * (RFC 6902) over the collection's state document
 * (`{ root, nodes: { [id]: node } }`): `forward` turns the state before
 * into the state after, `inverse` the other way. `seq` numbers the
 * revisions of one collection in order (the root's `revisionSeq`), so
 * "Restore to this change" undoes every later revision newest first.
 * `touched` lists the entities the patches change (`root` or node ids).
 * A revision whose patches would be too large keeps its metadata only
 * (`partial`); nothing older than it can be restored. Trimmed revisions
 * stay as stubs (`trimmed`, no patches), so a restore to one answers 409
 * rather than 404. `sessionStartSeq`/`sessionStartAt` name the first
 * revision of the changelog session it belongs to (set when written;
 * revisions written before they existed lack them and are grouped when
 * read).
 */
const revisionSchema = new Schema(
	{
		collectionId: { type: Schema.Types.ObjectId, required: true },
		seq: { type: Number, required: true },
		authorId: { type: String, required: true },
		at: { type: Date, required: true },
		entity: { type: String, required: true },
		entityId: { type: String, required: true },
		entityKind: { type: String, required: true },
		entityName: { type: String, required: true },
		action: { type: String, required: true },
		fields: { type: [String], default: [] },
		forward: { type: Schema.Types.Mixed, default: [] },
		inverse: { type: Schema.Types.Mixed, default: [] },
		touched: { type: [String], default: [] },
		partial: { type: Boolean, default: false },
		hidden: { type: Boolean, default: false },
		/** Trimmed from the changelog: a stub kept to tell it existed. */
		trimmed: { type: Boolean, default: false },
		bytes: { type: Number, required: true },
		sessionStartSeq: { type: Number },
		sessionStartAt: { type: Date },
	},
	{ collection: "collection_revisions", versionKey: false, minimize: false },
);
revisionSchema.index({ collectionId: 1, seq: -1 }, { unique: true });
revisionSchema.index({ collectionId: 1, touched: 1, seq: -1 });
// The newest revision without patches (what restores cannot cross), and
// the stubs of trimmed ones, without scanning the whole changelog.
revisionSchema.index(
	{ collectionId: 1, partial: 1, seq: -1 },
	{ name: "partial_by_seq", partialFilterExpression: { partial: true } },
);
revisionSchema.index(
	{ collectionId: 1, trimmed: 1, seq: -1 },
	{ name: "trimmed_by_seq", partialFilterExpression: { trimmed: true } },
);

export const CollectionRevisionModel = mongoose.model(
	"CollectionRevision",
	revisionSchema,
);

export interface StoredRevision {
	readonly _id: Types.ObjectId;
	readonly collectionId: Types.ObjectId;
	readonly seq: number;
	readonly authorId: string;
	readonly at: Date;
	readonly entity: ChangelogEntity;
	readonly entityId: string;
	readonly entityKind: ChangelogEntityKind;
	readonly entityName: string;
	readonly action: ChangelogAction;
	readonly fields: readonly string[];
	readonly forward: Operation[];
	readonly inverse: Operation[];
	readonly touched: readonly string[];
	readonly partial: boolean;
	readonly hidden: boolean;
	readonly trimmed?: boolean;
	readonly bytes: number;
	readonly sessionStartSeq?: number | null;
	readonly sessionStartAt?: Date | null;
}
