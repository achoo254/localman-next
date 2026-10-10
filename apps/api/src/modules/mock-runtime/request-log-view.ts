import { z } from "zod";
import {
	CALLBACK_EVENTS,
	REQUEST_LOG_SOURCES,
	type StoredLogMessage,
	type StoredRequestLog,
} from "./request-log-model.js";

/** One delivery attempt: `status` when answered, else `error`. */
export const attemptView = z.object({
	at: z.string(),
	status: z.number().optional(),
	error: z.string().optional(),
	ms: z.number(),
});
export type AttemptView = z.infer<typeof attemptView>;

export function toAttemptView(attempt: {
	readonly at: Date;
	readonly status?: number | undefined;
	readonly error?: string | undefined;
	readonly ms: number;
}): AttemptView {
	return {
		at: attempt.at.toISOString(),
		...(typeof attempt.status === "number" ? { status: attempt.status } : {}),
		...(typeof attempt.error === "string" ? { error: attempt.error } : {}),
		ms: attempt.ms,
	};
}

/**
 * A row of the live table (SSE event and list item). Inbox lines carry
 * `inbox` (and `target` when forwarded), callback lines `event` and
 * `target`; both carry their delivery `attempts` once known.
 */
export const logSummaryView = z.object({
	id: z.string(),
	at: z.string(),
	method: z.string(),
	path: z.string(),
	query: z.string(),
	status: z.number(),
	ms: z.number(),
	source: z.enum(REQUEST_LOG_SOURCES),
	requestSize: z.number(),
	responseSize: z.number(),
	inbox: z.string().optional(),
	event: z.enum(CALLBACK_EVENTS).optional(),
	target: z.string().optional(),
	attempts: z.array(attemptView).optional(),
});
export type LogSummaryView = z.infer<typeof logSummaryView>;

const logMessageView = z.object({
	headers: z.array(z.object({ name: z.string(), value: z.string() })),
	body: z.string(),
	bodyEncoding: z.enum(["utf8", "base64"]),
	size: z.number(),
	truncated: z.boolean(),
});

/** A whole line: the summary plus both sides with headers and bodies. */
export const logLineView = logSummaryView.extend({
	request: logMessageView,
	response: logMessageView,
});
export type LogLineView = z.infer<typeof logLineView>;

export function toLogSummary(line: StoredRequestLog): LogSummaryView {
	return {
		id: line._id.toHexString(),
		at: line.at.toISOString(),
		method: line.method,
		path: line.path,
		query: line.query,
		status: line.status,
		ms: line.ms,
		source: line.source,
		requestSize: line.request.size,
		responseSize: line.response.size,
		...(line.inbox === undefined ? {} : { inbox: line.inbox }),
		...(line.event === undefined ? {} : { event: line.event }),
		...(line.target === undefined ? {} : { target: line.target }),
		...(line.attempts === undefined
			? {}
			: { attempts: line.attempts.map(toAttemptView) }),
	};
}

function messageView(message: StoredLogMessage) {
	return {
		headers: message.headers.map(({ name, value }) => ({ name, value })),
		body: message.body,
		bodyEncoding: message.bodyEncoding,
		size: message.size,
		truncated: message.truncated,
	};
}

export function toLogLine(line: StoredRequestLog): LogLineView {
	return {
		...toLogSummary(line),
		request: messageView(line.request),
		response: messageView(line.response),
	};
}
