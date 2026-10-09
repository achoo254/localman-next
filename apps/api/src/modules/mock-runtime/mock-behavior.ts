import { OperationError } from "@localman/operations";
import {
	DEFAULT_RESPONSE,
	type JsonValue,
	type ResourceEndpoint,
} from "@localman/shared";
import { ruleHeaderIssue } from "@localman/shared/endpoint-behavior";
import { DelayGate } from "./chaos-delay.js";
import {
	CHAOS_RETRY_AFTER_SECONDS,
	type ChaosFault,
	type Rng,
	decideChaos,
	waitOf,
} from "./chaos.js";
import {
	RequestCounter,
	type RuleRequest,
	firstMatchingRule,
} from "./conditional-rules.js";
import { type EndpointCall, runEndpoint } from "./mock-endpoints.js";
import type { MockTarget } from "./mock-records.js";
import { rateLimited } from "./rate-limit.js";
import {
	type EndpointKind,
	renderResponse,
	usesCount,
} from "./render-response.js";

export interface BehaviorDeps {
	readonly rng: Rng;
	readonly gate: DelayGate;
	readonly counter: RequestCounter;
}

const DEFAULT_DEPS: BehaviorDeps = {
	// Read at call time, so a test can seed it.
	rng: () => Math.random(),
	gate: new DelayGate(),
	counter: new RequestCounter(),
};

/**
 * The `nth` counter key of an endpoint, within its project. The
 * resource's `revision` is part of it, so every save of the resource
 * starts counting again from 1 without the save having to find and reset
 * the counter; the keys of older revisions are no longer used and age
 * out of the counter's LRU. A restart of the API process starts over too.
 */
function counterKey(target: MockTarget, kind: EndpointKind): string {
	const { resource } = target;
	return `${resource._id.toHexString()}:${resource.revision ?? 0}:${kind}`;
}

/** A call as rules and chaos see it; `headers` is `null` over MCP. */
export interface BehaviorCall extends EndpointCall {
	readonly headers: RuleRequest["headers"];
	/** Aborts when the client goes away, ending any chaos wait early. */
	readonly signal?: AbortSignal;
}

export type BehaviorResult =
	| { readonly kind: "proceed" }
	| {
			readonly kind: "respond";
			readonly status: number;
			readonly body: JsonValue;
			readonly headers: readonly { name: string; value: string }[];
			/** Bytes to charge to the secret's byte budget. */
			readonly bytes: number;
	  }
	| {
			readonly kind: "fault";
			readonly error: OperationError;
			readonly retryAfterSeconds: number | null;
	  }
	| { readonly kind: "aborted" };

const PROCEED: BehaviorResult = { kind: "proceed" };

function faultResult(fault: ChaosFault): BehaviorResult {
	if (fault.kind === "rateLimit") {
		const { retryAfterSeconds } = fault;
		return {
			kind: "fault",
			error: rateLimited(retryAfterSeconds),
			retryAfterSeconds,
		};
	}
	const error =
		fault.kind === "timeout"
			? new OperationError(
					504,
					"MOCK_TIMEOUT",
					"Timeout injected by the endpoint's chaos settings",
				)
			: new OperationError(
					fault.status,
					"MOCK_CHAOS_ERROR",
					"Error injected by the endpoint's chaos settings",
				);
	return { kind: "fault", error, retryAfterSeconds: null };
}

/**
 * Runs an endpoint's conditional rules, then its chaos, before any CRUD:
 *
 * 1. Every request of an endpoint with rules counts for `nth`; the first
 *    rule that matches is the answer (no CRUD runs, nothing is written).
 * 2. Chaos draws a latency and maybe a fault. A matched rule only gets
 *    the latency; otherwise a timeout holds its `holdMs` then 504
 *    `MOCK_TIMEOUT`, or a 429 / error answers after the latency.
 * 3. Waits run on timers, end when the client leaves (`aborted`, nothing
 *    to send) and are capped per project (`busy`: 429 at once).
 *
 * A rule body renders like a custom response: `$mockData` and `$count`
 * are the endpoint's data for reads, `null` for writes.
 */
export async function runEndpointBehavior(
	endpoint: ResourceEndpoint,
	kind: EndpointKind,
	target: MockTarget,
	recordId: string | null,
	call: BehaviorCall,
	deps: BehaviorDeps = DEFAULT_DEPS,
): Promise<BehaviorResult> {
	const { rules, chaos } = endpoint;
	if (!rules?.length && !chaos) return PROCEED;
	const projectId = target.projectId.toHexString();
	const nth = rules?.length
		? deps.counter.next(projectId, counterKey(target, kind))
		: 0;
	const rule = firstMatchingRule(rules, { ...call, nth });
	const drawn = decideChaos(chaos, deps.rng);
	const decision = rule ? { latencyMs: drawn.latencyMs, fault: null } : drawn;
	const waited = await deps.gate.wait(projectId, waitOf(decision), call.signal);
	if (waited === "aborted") return { kind: "aborted" };
	if (waited === "busy") {
		const retryAfterSeconds = CHAOS_RETRY_AFTER_SECONDS;
		return faultResult({ kind: "rateLimit", retryAfterSeconds });
	}
	if (decision.fault) return faultResult(decision.fault);
	if (!rule) return PROCEED;

	const template = rule.response.body ?? DEFAULT_RESPONSE;
	const wantsCount = usesCount(template);
	const reads = kind === "list" || kind === "one";
	const result =
		reads && (wantsCount || JSON.stringify(template).includes('"$mockData"'))
			? await runEndpoint(kind, target, recordId, call, wantsCount)
			: null;
	const rendered = renderResponse(
		template,
		result?.data ?? null,
		result?.count ?? null,
	);
	return {
		kind: "respond",
		status: rule.response.status,
		body: rendered.body,
		// Rules saved before a tighter header policy keep working, without
		// the headers it no longer allows.
		headers: rule.response.headers.filter(
			({ name, value }) =>
				ruleHeaderIssue(name, value, rule.response.status) === null,
		),
		bytes: Math.max(rendered.bytes, result?.readBytes ?? 0),
	};
}
