/**
 * What an inbox or callback line adds to a log row: the inbox name or the
 * callback event, where it was delivered, and each delivery attempt.
 */
import {
	InvalidResponseError,
	type JsonRecord,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** One delivery try: `status` when the target answered, else `error`. */
export interface LogAttempt {
	at: string;
	status: number | null;
	error: string | null;
	ms: number;
}

export interface LogDelivery {
	/** Inbox lines: the inbox name. */
	inbox: string | null;
	/** Callback lines: `create`, `update` or `delete`. */
	event: string | null;
	/** Where the line was forwarded or sent (`tunnel:3000/hooks`, a URL). */
	target: string | null;
	/** Delivery attempts once known (at most 3). */
	attempts: LogAttempt[] | null;
}

function optionalNumber(data: JsonRecord, key: string): number | null {
	const value = data[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new InvalidResponseError(key);
	}
	return value;
}

function parseAttempt(value: unknown): LogAttempt {
	const data = expectRecord(value, "attempt");
	return {
		at: expectString(data, "at"),
		status: optionalNumber(data, "status"),
		error: optionalString(data, "error"),
		ms: expectNumber(data, "ms"),
	};
}

export function parseDelivery(data: JsonRecord): LogDelivery {
	const attempts = data.attempts;
	if (attempts !== undefined && attempts !== null && !Array.isArray(attempts)) {
		throw new InvalidResponseError("attempts");
	}
	return {
		inbox: optionalString(data, "inbox"),
		event: optionalString(data, "event"),
		target: optionalString(data, "target"),
		attempts: Array.isArray(attempts) ? attempts.map(parseAttempt) : null,
	};
}
