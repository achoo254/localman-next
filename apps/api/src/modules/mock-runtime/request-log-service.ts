import type { Types } from "mongoose";
import { type Logger, createLogger } from "../../logger.js";
import {
	type RequestLogInput,
	lineBytes,
	toStoredLine,
} from "./request-log-entry.js";
import { type LogListener, LogListeners } from "./request-log-listeners.js";
import {
	RequestLogModel,
	type StoredAttempt,
	type StoredRequestLog,
} from "./request-log-model.js";
import { LogTrimmer } from "./request-log-trim.js";

/** How often buffered lines are written to `request_logs`. */
export const LOG_FLUSH_INTERVAL_MS = 2_000;
/** Lines held in memory (buffered or being written) at most. */
export const MAX_BUFFERED_LINES = 5_000;
/** Bytes of those lines (`lineBytes`) at most; past either cap new lines are dropped. */
export const MAX_BUFFERED_BYTES = 32 * 1024 * 1024;
/** Dropped lines are reported in one warning at most this often. */
const DROP_WARNING_EVERY_MS = 60_000;

export interface RequestLogOptions {
	readonly maxBufferedLines?: number;
	readonly maxBufferedBytes?: number;
	/** Lines one project keeps in Mongo (`MAX_LINES_PER_PROJECT`). */
	readonly maxLinesPerProject?: number;
	readonly trimEveryMs?: number;
	/** Writes a batch; `insertMany` on `request_logs` by default. */
	readonly write?: (lines: StoredRequestLog[]) => Promise<unknown>;
}

const insertLines = (lines: StoredRequestLog[]) =>
	RequestLogModel.insertMany(lines, { ordered: false, lean: true });

/**
 * Request log of the mock runtime, the webhook inbox and mock callbacks.
 * `record` is synchronous and never throws: it masks and cuts the line,
 * hands it to live subscribers (SSE) at once and buffers it; the buffer
 * goes to Mongo in one `insertMany` every 2 seconds, early once it holds
 * a quarter of its byte cap, and on shutdown, like `UsageMeter`. Lines
 * buffered or being written stay under `MAX_BUFFERED_LINES` and
 * `MAX_BUFFERED_BYTES`: when Mongo is slow new lines are dropped and
 * counted, so the heap never grows with the backlog. After a write each
 * project is cut back to its newest `MAX_LINES_PER_PROJECT` lines.
 */
export class RequestLogService {
	private buffer: StoredRequestLog[] = [];
	private bufferBytes = 0;
	private writing = { lines: 0, bytes: 0 };
	private dropped = 0;
	private lastDropWarning = 0;
	private readonly live = new LogListeners((error) =>
		this.logger.warn({ err: error }, "Request log listener failed"),
	);
	private readonly maxLines: number;
	private readonly maxBytes: number;
	private readonly write: (lines: StoredRequestLog[]) => Promise<unknown>;
	private readonly trimmer: LogTrimmer;
	private timer: NodeJS.Timeout | undefined;
	private flushing: Promise<void> | undefined;
	private logger: Logger = createLogger("silent");

	constructor(options: RequestLogOptions = {}) {
		this.maxLines = options.maxBufferedLines ?? MAX_BUFFERED_LINES;
		this.maxBytes = options.maxBufferedBytes ?? MAX_BUFFERED_BYTES;
		this.write = options.write ?? insertLines;
		this.trimmer = new LogTrimmer(
			options.maxLinesPerProject,
			options.trimEveryMs,
		);
	}

	/** Installed by `main.ts`; silent until then. */
	configure(logger: Logger): void {
		this.logger = logger;
	}

	/** Bytes of the lines held in memory (buffered and being written). */
	get heldBytes(): number {
		return this.bufferBytes + this.writing.bytes;
	}

	/** Logs one exchange; returns the stored line (its `_id` is final). */
	record(input: RequestLogInput): StoredRequestLog | null {
		let line: StoredRequestLog;
		try {
			line = toStoredLine(input);
		} catch (error) {
			this.logger.error({ err: error }, "Request log line failed");
			return null;
		}
		this.live.publish(line);
		const bytes = lineBytes(line);
		const lines = this.buffer.length + this.writing.lines;
		if (lines >= this.maxLines || this.heldBytes + bytes > this.maxBytes) {
			this.dropped += 1;
			this.warnDropped();
			void this.flush();
			return line;
		}
		this.buffer.push(line);
		this.bufferBytes += bytes;
		if (this.bufferBytes >= this.maxBytes / 4) void this.flush();
		return line;
	}

	private warnDropped(now = Date.now()): void {
		const quiet = now - this.lastDropWarning < DROP_WARNING_EVERY_MS;
		if (this.dropped === 0 || quiet) return;
		this.logger.warn({ lines: this.dropped }, "Request log lines dropped");
		this.dropped = 0;
		this.lastDropWarning = now;
	}

	/**
	 * Sets the delivery attempts of a written line (an inbox forward that
	 * finished) and streams the line again under the same id, so live
	 * views replace the row. Buffered lines are written first; `null` when
	 * the line is gone (dropped, expired, cleared). Never throws.
	 */
	async amend(
		projectId: Types.ObjectId,
		lineId: Types.ObjectId,
		attempts: readonly StoredAttempt[],
	): Promise<StoredRequestLog | null> {
		try {
			await this.flush();
			const line = await RequestLogModel.findOneAndUpdate(
				{ _id: lineId, projectId },
				{ $set: { attempts } },
				{ returnDocument: "after" },
			).lean<StoredRequestLog>();
			if (line) this.live.publish(line);
			return line;
		} catch (error) {
			this.logger.error({ err: error }, "Request log amend failed");
			return null;
		}
	}

	/** Live lines of one project; returns the unsubscribe function. */
	subscribe(projectId: string, listener: LogListener): () => void {
		return this.live.subscribe(projectId, listener);
	}

	/** Writes the buffered lines; concurrent calls share one write. */
	flush(): Promise<void> {
		this.flushing ??= this.flushAll().finally(() => {
			this.flushing = undefined;
		});
		return this.flushing;
	}

	private async flushAll(): Promise<void> {
		while (this.buffer.length > 0) {
			const batch = this.buffer;
			this.writing = { lines: batch.length, bytes: this.bufferBytes };
			this.buffer = [];
			this.bufferBytes = 0;
			try {
				await this.write(batch);
				for (const line of batch) this.trimmer.note(line.projectId);
			} catch (error) {
				// Lines of a failed write are dropped: the log is best effort.
				this.logger.error(
					{ err: error, lines: batch.length },
					"Request log flush failed",
				);
				return;
			} finally {
				this.writing = { lines: 0, bytes: 0 };
			}
		}
		await this.trimmer.run().catch((error: unknown) => {
			this.logger.error({ err: error }, "Request log trim failed");
		});
		this.warnDropped();
	}

	/** Flushes every `LOG_FLUSH_INTERVAL_MS` until `stop`. */
	start(intervalMs = LOG_FLUSH_INTERVAL_MS): void {
		if (this.timer) return;
		this.timer = setInterval(() => void this.flush(), intervalMs);
		this.timer.unref();
	}

	/** Shutdown: stops the timer, then writes what is left. */
	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		await this.flush();
	}
}

/** The process's request log, shared by the mock runtime and the dashboard. */
export const requestLog = new RequestLogService();
