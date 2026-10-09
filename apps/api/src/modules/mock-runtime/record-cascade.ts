import type { JsonObject } from "@localman/shared";
import type { ClientSession, Types } from "mongoose";
import { RecordModel } from "../resources/record-model.js";
import {
	ResourceModel,
	type StoredResource,
} from "../resources/resource-model.js";
import { removalUpdate } from "./data-bytes.js";

/**
 * Deletes, level by level, every record below the deleted records `ids`
 * of `resourceId` and lowers each resource's `count` and `dataBytes`, so
 * no child record is left pointing at a missing parent. Child resources
 * are read inside the transaction (a resource added since the request
 * started is included). Filters use only system columns.
 */
export async function deleteDescendants(
	projectId: Types.ObjectId,
	resourceId: Types.ObjectId,
	ids: readonly string[],
	session: ClientSession,
): Promise<void> {
	const queue = [{ resourceId, ids }];
	for (let level = queue.shift(); level; level = queue.shift()) {
		const children = await ResourceModel.find({
			projectId,
			parentId: level.resourceId,
		})
			.select("_id dataBytes")
			.session(session)
			.lean<Pick<StoredResource, "_id" | "dataBytes">[]>();
		for (const child of children) {
			const filter = {
				resourceId: child._id,
				parentRecordId: { $in: [...level.ids] },
			};
			const doomed = await RecordModel.find(filter)
				.select("id data")
				.session(session)
				.lean<{ id: string; data: JsonObject }[]>();
			if (doomed.length === 0) continue;
			await RecordModel.deleteMany(filter, { session });
			await ResourceModel.updateOne(
				{ _id: child._id },
				removalUpdate(child, doomed),
				{ session },
			);
			queue.push({
				resourceId: child._id,
				ids: doomed.map((record) => record.id),
			});
		}
	}
}
