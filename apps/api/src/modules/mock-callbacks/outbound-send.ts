import { setTimeout as sleep } from "node:timers/promises";
import type { HeaderEntry } from "@localman/shared/api-client";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";
import { LOG_BODY_LIMIT } from "../mock-runtime/request-log-entry.js";
import type { StoredAttempt } from "../mock-runtime/request-log-model.js";
import {
	OutboundError,
	type OutboundResponse,
	defaultOutboundGuard,
	forwardHttpRequest,
} from "../mock-runtime/upstream-forwarder.js";
import {
	type TunnelLookup,
	ownerTunnelUrl,
} from "../mock-runtime/upstream-target.js";
import { type OutboundTarget, targetUrlOf } from "./outbound-target.js";

/** Attempts of one delivery, the first included. */
export const MAX_ATTEMPTS = 3;
/** Wait before the 2nd and the 3rd attempt. */
export const BACKOFF_MS: readonly number[] = Object.freeze([1_000, 4_000]);
/**
 * Deadline of one attempt of a callback or an inbox forward: short, so a
 * target that never answers holds a queue slot for 10 s, not 30.
 */
export const OUTBOUND_TIMEOUT_MS = 10_000;

/** What delivering needs; tests swap the guard, tunnels and timings. */
export interface OutboundDeps {
	readonly guard: SsrfGuard;
	readonly findTunnel: TunnelLookup;
	/** Deadline of one attempt (DNS, connect and the whole response). */
	readonly timeoutMs: number;
	/** `backoffMs[i]` is the wait after failed attempt `i + 1`. */
	readonly backoffMs: readonly number[];
}

export function defaultOutboundDeps(
	overrides: Partial<OutboundDeps> = {},
): OutboundDeps {
	return {
		guard: overrides.guard ?? defaultOutboundGuard(),
		findTunnel: overrides.findTunnel ?? ownerTunnelUrl,
		timeoutMs: overrides.timeoutMs ?? OUTBOUND_TIMEOUT_MS,
		backoffMs: overrides.backoffMs ?? BACKOFF_MS,
	};
}

/** One request to deliver (an inbox forward or a rendered callback). */
export interface OutboundMessage {
	readonly target: OutboundTarget;
	/** Appended to a tunnel target's path (`?` excluded). */
	readonly query: string;
	readonly method: string;
	readonly headers: readonly HeaderEntry[];
	readonly body: Buffer | null;
}

export interface AttemptOutcome {
	readonly attempt: StoredAttempt;
	readonly response: OutboundResponse | null;
	/** A network error, a timeout, no tunnel or a 5xx: worth another try. */
	readonly retry: boolean;
}

/**
 * Sends `message` once through the forwarder (DNS pinned, SSRF guard,
 * `X-Localman-Proxy: 1`, no redirects). A blocked address is final; so
 * is any answer below 500. The response is read up to one byte past the
 * log's 64 KB, so the log marks a longer body as cut.
 */
export async function attemptOnce(
	message: OutboundMessage,
	owner: string,
	deps: OutboundDeps,
	signal?: AbortSignal,
): Promise<AttemptOutcome> {
	const at = new Date();
	const started = performance.now();
	const elapsed = () => Math.round(performance.now() - started);
	const url = await targetUrlOf(
		message.target,
		owner,
		message.query,
		deps.findTunnel,
	);
	if (url === null) {
		return {
			attempt: { at, error: "no_tunnel", ms: elapsed() },
			response: null,
			retry: true,
		};
	}
	try {
		const response = await forwardHttpRequest(
			{
				url,
				method: message.method,
				headers: message.headers,
				body: message.body,
				timeoutMs: deps.timeoutMs,
				maxResponseBytes: LOG_BODY_LIMIT + 1,
				...(signal ? { signal } : {}),
			},
			deps.guard,
		);
		return {
			attempt: { at, status: response.status, ms: response.ms },
			response,
			retry: response.status >= 500,
		};
	} catch (error) {
		if (!(error instanceof OutboundError)) throw error;
		return {
			attempt: { at, error: error.reason, ms: elapsed() },
			response: null,
			retry: error.reason !== "blocked",
		};
	}
}

export interface DeliveryResult {
	readonly attempts: StoredAttempt[];
	/** The answer of the last attempt, if one came. */
	readonly response: OutboundResponse | null;
}

/**
 * A delivery that ends without sending (`queue_full`, `quota_exceeded`,
 * `expired`, `body_too_large`…): the attempts so far plus one with `error`.
 */
export function failedDelivery(
	attempts: readonly StoredAttempt[],
	error: string,
): DeliveryResult {
	return {
		attempts: [...attempts, { at: new Date(), error, ms: 0 }],
		response: null,
	};
}

/** Delivered: an answer below 500 came back. */
export function deliveredOk(result: DeliveryResult): boolean {
	const last = result.attempts.at(-1);
	return typeof last?.status === "number" && last.status < 500;
}

/** How the last delivery of a callback or inbox forward ended. */
export interface StoredDelivery {
	readonly at: Date;
	/** An answer below 500 came back. */
	readonly ok: boolean;
	readonly status: number | null;
	readonly ms: number;
	readonly attempts: StoredAttempt[];
}

/** The result kept as the last delivery. */
export function deliveryOf(result: DeliveryResult): StoredDelivery {
	const last = result.attempts.at(-1);
	return {
		at: last?.at ?? new Date(),
		ok: deliveredOk(result),
		status: last?.status ?? null,
		ms: last?.ms ?? 0,
		attempts: result.attempts,
	};
}

/**
 * Delivers at once, waiting `backoffMs` between at most `MAX_ATTEMPTS`
 * attempts (the "Send test" of a callback). Background deliveries go
 * through the Mongo queue instead, which spreads the same attempts over
 * polls.
 */
export async function deliverNow(
	message: OutboundMessage,
	owner: string,
	deps: OutboundDeps,
	signal?: AbortSignal,
): Promise<DeliveryResult> {
	const attempts: StoredAttempt[] = [];
	for (;;) {
		const outcome = await attemptOnce(message, owner, deps, signal);
		attempts.push(outcome.attempt);
		const wait = deps.backoffMs[attempts.length - 1];
		if (!outcome.retry || attempts.length >= MAX_ATTEMPTS || signal?.aborted) {
			return { attempts, response: outcome.response };
		}
		await sleep(wait ?? 0, undefined, signal ? { signal } : {}).catch(
			() => undefined,
		);
	}
}
