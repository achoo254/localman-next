import { RequestLogModel, type StoredRequestLog } from "./request-log-model.js";

/** How often buffered lines are written to `request_logs`. */
export const LOG_FLUSH_INTERVAL_MS = 2_000;
/** Lines held in memory (buffered or being written) at most. */
export const MAX_BUFFERED_LINES = 5_000;
/** Bytes of those lines (`lineBytes`) at most; past either cap new lines are dropped. */
export const MAX_BUFFERED_BYTES = 32 * 1024 * 1024;

export interface RequestLogOptions {
	readonly maxBufferedLines?: number;
	readonly maxBufferedBytes?: number;
	/** Lines one project keeps in Mongo (`MAX_LINES_PER_PROJECT`). */
	readonly maxLinesPerProject?: number;
	readonly trimEveryMs?: number;
	/** Writes a batch of one tenant (in it); `insertMany` by default. */
	readonly write?: (lines: StoredRequestLog[]) => Promise<unknown>;
}

export const insertLines = (lines: StoredRequestLog[]) =>
	RequestLogModel.insertMany(lines, { ordered: false, lean: true });
