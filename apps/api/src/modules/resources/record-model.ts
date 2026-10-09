import {
	type JsonObject,
	type JsonValue,
	OBJECT_ID_FIELD,
} from "@localman/shared";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * One record of a resource. `id` (the Object ID) and `parentRecordId` (the
 * Parent ID) live in their own columns, not in `data`, so renaming or
 * moving a resource never rewrites records; `toRecordView` puts them back.
 * The mongoose `id` virtual is disabled because `id` is a real column.
 * Records are listed in insertion order (`_id`).
 */
const recordSchema = new Schema(
	{
		resourceId: { type: Schema.Types.ObjectId, required: true },
		projectId: { type: Schema.Types.ObjectId, required: true },
		parentRecordId: { type: String, default: null },
		id: { type: String, required: true },
		data: { type: Schema.Types.Mixed, required: true, default: {} },
	},
	{ collection: "records", versionKey: false, id: false, minimize: false },
);
recordSchema.index({ resourceId: 1, id: 1 }, { unique: true });
recordSchema.index({ resourceId: 1, parentRecordId: 1 });
recordSchema.index({ projectId: 1 });

export const RecordModel = mongoose.model("Record", recordSchema);

export interface StoredRecord {
	readonly _id: Types.ObjectId;
	readonly resourceId: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly parentRecordId: string | null;
	readonly id: string;
	readonly data: JsonObject;
}

/** A record as users see it: `id`, then `{parent}Id`, then the fields. */
export function toRecordView(
	record: Pick<StoredRecord, "id" | "parentRecordId" | "data">,
	parentKey: string | null,
): JsonObject {
	const entries: [string, JsonValue][] = [[OBJECT_ID_FIELD, record.id]];
	if (parentKey !== null) entries.push([parentKey, record.parentRecordId]);
	for (const [key, value] of Object.entries(record.data)) {
		if (key !== OBJECT_ID_FIELD && key !== parentKey)
			entries.push([key, value]);
	}
	// fromEntries defines own properties: a `__proto__` key stays data.
	return Object.fromEntries(entries);
}
