import { OperationError } from "@localman/operations";
import { type JsonObject, MAX_RECORDS_PER_RESOURCE } from "@localman/shared";
import type { ClientSession } from "mongoose";
import { inProjectTransaction } from "../projects/project-lock.js";
import { RecordModel, toRecordView } from "../resources/record-model.js";
import {
	ResourceModel,
	type StoredResource,
} from "../resources/resource-model.js";
import { checkedBytesDelta, removalUpdate } from "./data-bytes.js";
import {
	type MockTarget,
	ancestorsExist,
	findRecord,
	viewOf,
} from "./mock-records.js";
import { freeId, parentOfNew } from "./new-record.js";
import { mergeData, readRecordBody, withMissingFields } from "./record-body.js";
import { deleteDescendants } from "./record-cascade.js";
import { withRelations } from "./relation-fields.js";

/**
 * POST fills schema fields the body left out with generated values (Jev's
 * choice, low confidence 0.16). Set to false to store the body as sent.
 */
export const FILL_MISSING_FIELDS_ON_CREATE = true;

function recordLimitReached(): OperationError {
	return new OperationError(
		409,
		"RECORD_LIMIT_REACHED",
		`A resource holds at most ${MAX_RECORDS_PER_RESOURCE} records`,
		{ max: MAX_RECORDS_PER_RESOURCE },
	);
}

async function withRelationsOne(
	target: MockTarget,
	view: JsonObject,
	session: ClientSession,
): Promise<JsonObject> {
	const [resolved] = await withRelations(target, [view], session);
	return resolved ?? view;
}

/** The target resource as stored now (`count`, `nextId`, `dataBytes`). */
function currentResource(
	target: MockTarget,
	session: ClientSession,
): Promise<StoredResource | null> {
	return ResourceModel.findOne({
		_id: target.resource._id,
		projectId: target.projectId,
	})
		.session(session)
		.lean<StoredResource>();
}

/**
 * POST: stores a record with `id = nextId` (then `nextId + 1`) under the
 * project lock, so `count`, `nextId` and the parent link stay consistent
 * with dashboard writes. `null` when the route's parent records are gone.
 */
export async function createRecord(
	target: MockTarget,
	body: unknown,
): Promise<JsonObject | null> {
	const { data, parentRef } = readRecordBody(body, target);
	return inProjectTransaction(target.projectId, async (session) => {
		if (!(await ancestorsExist(target, session))) return null;
		const resource = await currentResource(target, session);
		if (!resource) return null;
		if (resource.count >= MAX_RECORDS_PER_RESOURCE) throw recordLimitReached();
		const current = { ...target, resource };
		const parentRecordId = await parentOfNew(current, parentRef, session);
		const index = await freeId(resource, session);
		const record = {
			id: String(index),
			parentRecordId,
			data: FILL_MISSING_FIELDS_ON_CREATE
				? withMissingFields(data, current, index)
				: data,
		};
		const bytes = await checkedBytesDelta(resource, record, null, session);
		await RecordModel.collection.insertOne(
			{ ...record, resourceId: resource._id, projectId: resource.projectId },
			{ session },
		);
		await ResourceModel.updateOne(
			{ _id: resource._id },
			{ $inc: { count: 1, dataBytes: bytes }, $set: { nextId: index + 1 } },
			{ session },
		);
		return withRelationsOne(
			current,
			toRecordView(record, target.parentKey),
			session,
		);
	});
}

/**
 * PUT and PATCH: merge the body into the stored fields (both merge, like
 * the source). `id` and `{parent}Id` never change. `null`: not found.
 */
export async function updateRecord(
	target: MockTarget,
	id: string,
	body: unknown,
): Promise<JsonObject | null> {
	const { data } = readRecordBody(body, target);
	return inProjectTransaction(target.projectId, async (session) => {
		if (!(await ancestorsExist(target, session))) return null;
		const record = await findRecord(target, id, session);
		const resource = record ? await currentResource(target, session) : null;
		if (!record || !resource) return null;
		const updated = { ...record, data: mergeData(record.data, data) };
		const bytes = await checkedBytesDelta(resource, updated, record, session);
		// The whole `data` is replaced: no update path is built from user keys.
		await RecordModel.collection.updateOne(
			{ _id: record._id },
			{ $set: { data: updated.data } },
			{ session },
		);
		if (bytes !== 0) {
			await ResourceModel.updateOne(
				{ _id: resource._id },
				{ $inc: { dataBytes: bytes } },
				{ session },
			);
		}
		return withRelationsOne(target, viewOf(target, updated), session);
	});
}

/**
 * DELETE: removes the record and, level by level, every record below it.
 * Answers the deleted record (relations resolved before deletion).
 */
export async function deleteRecord(
	target: MockTarget,
	id: string,
): Promise<JsonObject | null> {
	return inProjectTransaction(target.projectId, async (session) => {
		if (!(await ancestorsExist(target, session))) return null;
		const record = await findRecord(target, id, session);
		const resource = record ? await currentResource(target, session) : null;
		if (!record || !resource) return null;
		const view = await withRelationsOne(
			target,
			viewOf(target, record),
			session,
		);
		await RecordModel.deleteOne({ _id: record._id }, { session });
		await ResourceModel.updateOne(
			{ _id: resource._id },
			removalUpdate(resource, [record]),
			{ session },
		);
		await deleteDescendants(
			target.projectId,
			resource._id,
			[record.id],
			session,
		);
		return view;
	});
}
