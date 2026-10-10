import type { Types } from "mongoose";
import { ResourceModel } from "../resources/resource-model.js";

export interface ProjectCounts {
	readonly resourceCount: number;
	readonly recordCount: number;
}

export const NO_COUNTS: ProjectCounts = Object.freeze({
	resourceCount: 0,
	recordCount: 0,
});

/**
 * Resources and records per project id (hex), in one aggregate over the
 * resources (matched on the `projectId` prefix of their tree index).
 * Records are the sum of each resource's `count`, which every write keeps
 * equal to its number of records, so no record is read. Projects without
 * resources are missing from the map (`NO_COUNTS`).
 */
export async function projectCounts(
	projectIds: readonly Types.ObjectId[],
): Promise<Map<string, ProjectCounts>> {
	if (projectIds.length === 0) return new Map();
	const rows = await ResourceModel.aggregate<{
		_id: Types.ObjectId;
		resources: number;
		records: number;
	}>([
		{ $match: { projectId: { $in: [...projectIds] } } },
		{
			$group: {
				_id: "$projectId",
				resources: { $sum: 1 },
				records: { $sum: "$count" },
			},
		},
	]);
	return new Map(
		rows.map((row) => [
			row._id.toHexString(),
			{ resourceCount: row.resources, recordCount: row.records },
		]),
	);
}
