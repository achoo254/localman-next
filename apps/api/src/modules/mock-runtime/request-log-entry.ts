import { limitsFor } from "@localman/shared";
import type { HeaderEntry } from "@localman/shared/api-client";
import { Types } from "mongoose";
import { encodeBody } from "../api-client/proxy-response-body.js";
import { type StoredPlan, effectivePlan } from "../billing/plan-guard.js";
import type {
	CallbackEvent,
	RequestLogSource,
	StoredAttempt,
	StoredLogMessage,
	StoredRequestLog,
} from "./request-log-model.js";

/** Bytes of a body kept in a log line; the rest is cut (`truncated`). */
export const LOG_BODY_LIMIT = 64 * 1024;
/** Value shown in place of a masked header. */
export const REDACTED = "[redacted]";
/** Always masked, whatever the project adds. */
export const DEFAULT_REDACTED_HEADERS: readonly string[] = Object.freeze([
	"authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
]);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A body as seen: its first bytes (at least the first `LOG_BODY_LIMIT`
 * when there are that many) and the size of the whole body.
 */
export interface LogBodyInput {
	readonly bytes: Buffer;
	readonly size: number;
}

export interface LogMessageInput {
	readonly headers: readonly HeaderEntry[];
	readonly body: LogBodyInput | null;
}

/** What a writer hands to `RequestLogService.record`. */
export interface RequestLogInput {
	readonly projectId: Types.ObjectId | string;
	/** Owner's stored plan when the line is written: its days set the TTL. */
	readonly ownerPlan: StoredPlan;
	/** The project's extra masked header names. */
	readonly redactHeaders: readonly string[];
	readonly at: Date;
	readonly method: string;
	/** Percent-encoded path (below the secret for mock traffic). */
	readonly path: string;
	/** Raw query without `?`. */
	readonly query: string;
	readonly status: number;
	readonly ms: number;
	readonly source: RequestLogSource;
	readonly request: LogMessageInput;
	readonly response: LogMessageInput;
	/** Id of the line, when the writer must know it before (inbox forward). */
	readonly id?: Types.ObjectId;
	readonly inbox?: string;
	readonly event?: CallbackEvent;
	readonly target?: string;
	readonly attempts?: readonly StoredAttempt[];
}

/** The optional delivery fields of a line, only those that are set. */
function deliveryOf(input: RequestLogInput): Partial<StoredRequestLog> {
	return {
		...(input.inbox === undefined ? {} : { inbox: input.inbox }),
		...(input.event === undefined ? {} : { event: input.event }),
		...(input.target === undefined ? {} : { target: input.target }),
		...(input.attempts === undefined ? {} : { attempts: [...input.attempts] }),
	};
}

/** `headers` with every masked name's value replaced, order kept. */
export function redactHeaders(
	headers: readonly HeaderEntry[],
	extra: readonly string[],
): HeaderEntry[] {
	const masked = new Set([
		...DEFAULT_REDACTED_HEADERS,
		...extra.map((name) => name.toLowerCase()),
	]);
	return headers.map(({ name, value }) => ({
		name,
		value: masked.has(name.trim().toLowerCase()) ? REDACTED : value,
	}));
}

function messageOf(
	input: LogMessageInput,
	extra: readonly string[],
): StoredLogMessage {
	const bytes = input.body?.bytes ?? Buffer.alloc(0);
	const size = Math.max(input.body?.size ?? 0, bytes.length);
	const kept = bytes.subarray(0, LOG_BODY_LIMIT);
	const truncated = size > kept.length;
	const encoded = encodeBody(kept, truncated);
	return {
		headers: redactHeaders(input.headers, extra),
		body: encoded.body,
		bodyEncoding: encoded.bodyEncoding,
		size,
		truncated,
	};
}

/** Fixed part of a line (ids, dates, numbers, field names) in `lineBytes`. */
const LINE_OVERHEAD_BYTES = 256;

const utf8Bytes = (text: string): number => Buffer.byteLength(text);

function messageBytes(message: StoredLogMessage): number {
	return message.headers.reduce(
		(sum, header) => sum + utf8Bytes(header.name) + utf8Bytes(header.value),
		utf8Bytes(message.body),
	);
}

/**
 * Size of a stored line (bodies already cut, headers masked): what the
 * request log's buffer holds in memory and writes to Mongo for it.
 */
export function lineBytes(line: StoredRequestLog): number {
	return (
		LINE_OVERHEAD_BYTES +
		utf8Bytes(line.path) +
		utf8Bytes(line.query) +
		utf8Bytes(line.target ?? "") +
		messageBytes(line.request) +
		messageBytes(line.response)
	);
}

/** Days a line written now is kept, from the owner's effective plan. */
export function logDaysOf(plan: StoredPlan, at: Date): number {
	return limitsFor(effectivePlan(plan, at)).requestLogDays;
}

/** The document of a line: masked headers, 64 KB bodies, its expiry. */
export function toStoredLine(input: RequestLogInput): StoredRequestLog {
	return {
		_id: input.id ?? new Types.ObjectId(),
		projectId:
			typeof input.projectId === "string"
				? new Types.ObjectId(input.projectId)
				: input.projectId,
		at: input.at,
		method: input.method,
		path: input.path,
		query: input.query,
		status: input.status,
		ms: Math.max(0, Math.round(input.ms)),
		source: input.source,
		request: messageOf(input.request, input.redactHeaders),
		response: messageOf(input.response, input.redactHeaders),
		expiresAt: new Date(
			input.at.getTime() + logDaysOf(input.ownerPlan, input.at) * DAY_MS,
		),
		...deliveryOf(input),
	};
}
