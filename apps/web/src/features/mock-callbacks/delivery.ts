/**
 * The last delivery of a mock callback or an inbox forward, as the API
 * answers it (`Delivery`): shared by the callbacks editor and the inboxes.
 */
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

/** Why an attempt got no answer. */
export const DELIVERY_ERRORS = [
	"no_tunnel",
	"connect",
	"timeout",
	"dns",
	"blocked",
	"body_too_large",
	"invalid_target",
	"queue_full",
	"quota_exceeded",
	"expired",
] as const;
export type DeliveryError = (typeof DELIVERY_ERRORS)[number];

export interface DeliveryAttempt {
	at: string;
	/** The target's answer; null when none came. */
	status: number | null;
	/** Known reason without an answer; null otherwise (or unknown). */
	error: DeliveryError | null;
	ms: number;
}

export interface Delivery {
	at: string;
	/** An answer below 500 came. */
	ok: boolean;
	status: number | null;
	ms: number;
	attempts: DeliveryAttempt[];
}

/** Retries of one delivery, the "3" of "Attempt 1/3". */
export const MAX_ATTEMPTS = 3;

export function isDeliveryError(value: string): value is DeliveryError {
	return DELIVERY_ERRORS.some((code) => code === value);
}

function optionalNumber(data: JsonRecord, key: string): number | null {
	const value = data[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new InvalidResponseError(key);
	}
	return value;
}

function parseAttempt(value: unknown): DeliveryAttempt {
	const data = expectRecord(value, "attempt");
	const error = optionalString(data, "error");
	return {
		at: expectString(data, "at"),
		status: optionalNumber(data, "status"),
		error: error !== null && isDeliveryError(error) ? error : null,
		ms: expectNumber(data, "ms"),
	};
}

/** `null` stays `null` (never delivered). */
export function parseDelivery(value: unknown): Delivery | null {
	if (value === null || value === undefined) return null;
	if (!isRecord(value)) throw new InvalidResponseError("delivery");
	return {
		at: expectString(value, "at"),
		ok: expectBoolean(value, "ok"),
		status: optionalNumber(value, "status"),
		ms: expectNumber(value, "ms"),
		attempts: expectArray(value, "attempts").map(parseAttempt),
	};
}

/** No tunnel was mapped for the port: worth showing the tunnel status. */
export function missedTunnel(delivery: Delivery | null): boolean {
	return (
		delivery?.attempts.some((attempt) => attempt.error === "no_tunnel") ?? false
	);
}
