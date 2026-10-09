import {
	type JsonObject,
	MAX_RECORD_BYTES,
	MAX_RESOURCE_BYTES,
} from "@localman/shared";
import type { ClientSession } from "mongoose";
import {
	dataTooLarge,
	recordBytes,
	resourceRef,
} from "../resources/data-size.js";
import { RecordModel } from "../resources/record-model.js";
import {
	ResourceModel,
	type StoredResource,
} from "../resources/resource-model.js";

type MeasuredRecord = { readonly id: string; readonly data: JsonObject };

/**
 * The resource's `dataBytes`. Resources stored before the field existed
 * are measured once here (the same `recordBytes` as the dashboard) and
 * the result is stored in the caller's transaction.
 */
export async function storedDataBytes(
	resource: StoredResource,
	session: ClientSession,
): Promise<number> {
	if (typeof resource.dataBytes === "number") return resource.dataBytes;
	const records = await RecordModel.find({ resourceId: resource._id })
		.select("id data")
		.session(session)
		.lean<MeasuredRecord[]>();
	const bytes = records.reduce((sum, record) => sum + recordBytes(record), 0);
	await ResourceModel.updateOne(
		{ _id: resource._id },
		{ $set: { dataBytes: bytes } },
		{ session },
	);
	return bytes;
}

/**
 * Checks a write against the byte caps by delta, without reading the
 * other records: `record` (replacing `previous`, if any) must fit
 * `MAX_RECORD_BYTES`, and the stored total minus `previous` plus `record`
 * must fit `MAX_RESOURCE_BYTES` (413 `DATA_TOO_LARGE` otherwise). Returns
 * the change to add to `dataBytes`.
 */
export async function checkedBytesDelta(
	resource: StoredResource,
	record: MeasuredRecord,
	previous: MeasuredRecord | null,
	session: ClientSession,
): Promise<number> {
	const ref = resourceRef(resource);
	const size = recordBytes(record);
	if (size > MAX_RECORD_BYTES) throw dataTooLarge("record", size, ref);
	const before = previous === null ? 0 : recordBytes(previous);
	const total = (await storedDataBytes(resource, session)) - before + size;
	if (total > MAX_RESOURCE_BYTES) throw dataTooLarge("resource", total, ref);
	return size - before;
}

/**
 * `$inc` of a resource losing records: `count` always, `dataBytes` only
 * when the resource has it (an unmeasured one is measured later).
 */
export function removalUpdate(
	resource: Pick<StoredResource, "dataBytes">,
	records: readonly MeasuredRecord[],
): { $inc: { count: number; dataBytes?: number } } {
	const count = -records.length;
	if (typeof resource.dataBytes !== "number") return { $inc: { count } };
	const bytes = records.reduce((sum, record) => sum + recordBytes(record), 0);
	return { $inc: { count, dataBytes: -bytes } };
}
