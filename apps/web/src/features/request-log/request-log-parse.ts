/** Request log lines as the API returns them, checked at the edge. */
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";
import { type LogDelivery, parseDelivery } from "./log-delivery-parse";

export const LOG_SOURCES = [
	"mock",
	"rule",
	"upstream",
	"inbox",
	"callback",
] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export function isLogSource(value: string): value is LogSource {
	return LOG_SOURCES.some((source) => source === value);
}

/** A row of the table: list item and live event. */
export interface LogSummary extends LogDelivery {
	id: string;
	/** ISO time the request arrived. */
	at: string;
	method: string;
	/** Below the secret, prefix included. */
	path: string;
	/** Raw query without `?`. */
	query: string;
	status: number;
	ms: number;
	source: LogSource;
	requestSize: number;
	responseSize: number;
}

export interface LogHeader {
	name: string;
	/** `[redacted]` for a masked header. */
	value: string;
}

export type BodyEncoding = "utf8" | "base64";

export interface LogMessage {
	headers: LogHeader[];
	body: string;
	bodyEncoding: BodyEncoding;
	/** Size of the whole body in bytes (the stored one may be cut). */
	size: number;
	truncated: boolean;
}

export interface LogLine extends LogSummary {
	request: LogMessage;
	response: LogMessage;
}

export interface LogPage {
	items: LogSummary[];
	nextCursor: string | null;
}

/** Answer of a replay: the mock's response to the same request. */
export interface ReplayResult extends LogMessage {
	status: number;
	ms: number;
	/** `X-Localman-Source` of the answer (`mock`, `upstream`), if any. */
	source: string | null;
}

/** Value of a masked header. */
export const REDACTED = "[redacted]";

function parseSummaryRecord(data: JsonRecord): LogSummary {
	const source = expectString(data, "source");
	if (!isLogSource(source))
		throw new InvalidResponseError(`source "${source}"`);
	return {
		id: expectString(data, "id"),
		at: expectString(data, "at"),
		method: expectString(data, "method"),
		path: expectString(data, "path"),
		query: expectString(data, "query"),
		status: expectNumber(data, "status"),
		ms: expectNumber(data, "ms"),
		source,
		requestSize: expectNumber(data, "requestSize"),
		responseSize: expectNumber(data, "responseSize"),
		...parseDelivery(data),
	};
}

export function parseSummary(value: unknown): LogSummary {
	return parseSummaryRecord(expectRecord(value, "request log row"));
}

/** The `data` of an SSE `log` event, or `null` when it is not a row. */
export function parseLogEvent(data: string): LogSummary | null {
	try {
		const value: unknown = JSON.parse(data);
		return isRecord(value) ? parseSummaryRecord(value) : null;
	} catch {
		return null;
	}
}

function parseHeaders(data: JsonRecord): LogHeader[] {
	return expectArray(data, "headers").map((item) => {
		const header = expectRecord(item, "header");
		return {
			name: expectString(header, "name"),
			value: expectString(header, "value"),
		};
	});
}

function parseMessageRecord(data: JsonRecord): LogMessage {
	const encoding = expectString(data, "bodyEncoding");
	if (encoding !== "utf8" && encoding !== "base64") {
		throw new InvalidResponseError(`bodyEncoding "${encoding}"`);
	}
	return {
		headers: parseHeaders(data),
		body: expectString(data, "body"),
		bodyEncoding: encoding,
		size: expectNumber(data, "size"),
		truncated: expectBoolean(data, "truncated"),
	};
}

export function parsePage(value: unknown): LogPage {
	const data = expectRecord(value, "request log page");
	return {
		items: expectArray(data, "items").map(parseSummary),
		nextCursor: optionalString(data, "nextCursor"),
	};
}

export function parseLine(value: unknown): LogLine {
	const data = expectRecord(value, "request log line");
	return {
		...parseSummaryRecord(data),
		request: parseMessageRecord(expectRecord(data.request, "request")),
		response: parseMessageRecord(expectRecord(data.response, "response")),
	};
}

export function parseReplay(value: unknown): ReplayResult {
	const data = expectRecord(value, "replay");
	return {
		...parseMessageRecord(data),
		status: expectNumber(data, "status"),
		ms: expectNumber(data, "ms"),
		source: optionalString(data, "source"),
	};
}

/** `X-Localman-Source` among headers (case-insensitive), or null. */
export function localmanSource(headers: readonly LogHeader[]): string | null {
	const header = headers.find(
		(item) => item.name.toLowerCase() === "x-localman-source",
	);
	return header ? header.value : null;
}
