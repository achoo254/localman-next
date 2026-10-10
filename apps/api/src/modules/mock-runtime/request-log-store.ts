import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { registerProjectDependent } from "../projects/project-dependents.js";
import { type LogFilter, toMongoFilter } from "./request-log-filter.js";
import { RequestLogModel, type StoredRequestLog } from "./request-log-model.js";
import { requestLog } from "./request-log-service.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
/** Server-side cap of a log query (a rare path filter scans the project). */
export const LOG_QUERY_MAX_MS = 5_000;

// Logs go with their project; a clone starts with an empty log. Lines
// still buffered are written first, so none outlives the deletion.
registerProjectDependent({
	kind: "requestLogs",
	count: (projectId) => RequestLogModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await requestLog.flush();
		await RequestLogModel.deleteMany({ projectId });
	},
});

export function logNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Request log line not found");
}

/**
 * A line of the project. A line streamed a moment ago may still sit in
 * the buffer: one flush, then a second look.
 */
export async function requireLogLine(
	projectId: Types.ObjectId,
	logId: string,
): Promise<StoredRequestLog> {
	if (!OBJECT_ID.test(logId)) throw logNotFound();
	const find = () =>
		RequestLogModel.findOne({ _id: logId, projectId }).lean<StoredRequestLog>();
	const line = (await find()) ?? (await requestLog.flush().then(find));
	if (!line) throw logNotFound();
	return line;
}

export interface LogPage {
	readonly items: StoredRequestLog[];
	readonly nextCursor: string | null;
}

/** Newest first; `cursor` is the `nextCursor` of the previous page. */
export async function listLogLines(
	projectId: Types.ObjectId,
	filter: LogFilter,
	limit: number,
	cursor: string | undefined,
): Promise<LogPage> {
	if (cursor !== undefined && !OBJECT_ID.test(cursor)) {
		throw new OperationError(400, "VALIDATION_ERROR", "Invalid input", [
			{ path: "cursor", message: "must be a nextCursor of a previous page" },
		]);
	}
	await requestLog.flush();
	const items = await RequestLogModel.find({
		projectId,
		...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}),
		...toMongoFilter(filter),
	})
		.sort({ _id: -1 })
		.limit(limit + 1)
		.maxTimeMS(LOG_QUERY_MAX_MS)
		.lean<StoredRequestLog[]>();
	const more = items.length > limit;
	const page = more ? items.slice(0, limit) : items;
	const last = page.at(-1);
	return {
		items: page,
		nextCursor: more && last ? last._id.toHexString() : null,
	};
}

/** Every line of the project (after writing the buffered ones). */
export async function countLogLines(
	projectId: Types.ObjectId,
): Promise<number> {
	await requestLog.flush();
	return RequestLogModel.countDocuments({ projectId });
}

export async function deleteLogLines(
	projectId: Types.ObjectId,
): Promise<number> {
	await requestLog.flush();
	const result = await RequestLogModel.deleteMany({ projectId });
	return result.deletedCount;
}
