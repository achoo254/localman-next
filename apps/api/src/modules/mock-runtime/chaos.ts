import {
	type EndpointChaos,
	MAX_CHAOS_DELAY_MS,
} from "@localman/shared/endpoint-behavior";

/** A source of uniform numbers in [0, 1); `Math.random` outside tests. */
export type Rng = () => number;

/**
 * How long a chaos timeout holds the request before its 504 when
 * `latencyMs` has no maximum; otherwise it holds that maximum (both are
 * within `MAX_CHAOS_DELAY_MS`).
 */
export const DEFAULT_TIMEOUT_HOLD_MS = 10_000;
/** `Retry-After` of a chaos 429. */
export const CHAOS_RETRY_AFTER_SECONDS = 1;

export type ChaosFault =
	| { readonly kind: "error"; readonly status: number }
	| { readonly kind: "timeout"; readonly holdMs: number }
	| { readonly kind: "rateLimit"; readonly retryAfterSeconds: number };

export interface ChaosDecision {
	/** Latency drawn from `latencyMs`, inclusive on both ends. */
	readonly latencyMs: number;
	readonly fault: ChaosFault | null;
}

const NO_CHAOS: ChaosDecision = { latencyMs: 0, fault: null };

function clampDelay(ms: number): number {
	return Math.min(MAX_CHAOS_DELAY_MS, Math.max(0, Math.floor(ms)));
}

/**
 * Draws what chaos does to one request: a latency in `latencyMs`, then a
 * single roll split into timeout, 429 and error bands (in that order), so
 * each happens with exactly its configured rate. Validation keeps the
 * rates summing to at most 1; stored values are clamped anyway.
 */
export function decideChaos(
	chaos: EndpointChaos | undefined,
	rng: Rng,
): ChaosDecision {
	if (!chaos) return NO_CHAOS;
	const [min, max] = chaos.latencyMs;
	const low = clampDelay(min);
	const high = Math.max(low, clampDelay(max));
	const latencyMs = low + Math.floor(rng() * (high - low + 1));
	const roll = rng();
	let band = chaos.timeoutRate;
	if (roll < band) {
		const holdMs = high > 0 ? high : DEFAULT_TIMEOUT_HOLD_MS;
		return { latencyMs, fault: { kind: "timeout", holdMs } };
	}
	band += chaos.rateLimitRate ?? 0;
	if (roll < band) {
		return {
			latencyMs,
			fault: {
				kind: "rateLimit",
				retryAfterSeconds: CHAOS_RETRY_AFTER_SECONDS,
			},
		};
	}
	band += chaos.errorRate;
	if (roll < band) {
		return { latencyMs, fault: { kind: "error", status: chaos.errorStatus } };
	}
	return { latencyMs, fault: null };
}

/** How long the request waits before it is answered (or times out). */
export function waitOf(decision: ChaosDecision): number {
	return decision.fault?.kind === "timeout"
		? decision.fault.holdMs
		: decision.latencyMs;
}
