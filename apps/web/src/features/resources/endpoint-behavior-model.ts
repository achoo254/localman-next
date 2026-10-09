import type {
	RuleOp,
	EndpointChaos as SharedChaos,
	EndpointRule as SharedRule,
} from "@localman/shared/endpoint-behavior";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
} from "../../lib/json-guards";

/*
 * Chaos and conditional rules of an endpoint, as the API returns and takes
 * them. Only types come from `@localman/shared/endpoint-behavior`: its
 * schemas pull zod, which the project page (this parser) must not load.
 */

export type { RuleOp } from "@localman/shared/endpoint-behavior";
export type EndpointChaos = SharedChaos;
export type RuleMatch = SharedRule["match"];
export type RuleSource = RuleMatch["source"];

export interface RuleHeader {
	name: string;
	value: string;
}

/** A conditional response; `body` absent means `"$mockData"`. */
export interface EndpointRule {
	match: RuleMatch;
	op: RuleOp;
	value?: string | number;
	response: { status: number; body?: unknown; headers: RuleHeader[] };
}

/** Rule operators and sources in menu order (same as the shared lists). */
export const RULE_OP_LIST = [
	"eq",
	"neq",
	"contains",
	"regex",
	"exists",
	"gt",
	"lt",
] as const satisfies readonly RuleOp[];
export const RULE_SOURCE_LIST = [
	"header",
	"query",
	"body",
	"nth",
] as const satisfies readonly RuleSource[];

function isOp(value: string): value is RuleOp {
	return (RULE_OP_LIST as readonly string[]).includes(value);
}

function isSource(value: string): value is RuleSource {
	return (RULE_SOURCE_LIST as readonly string[]).includes(value);
}

export function parseChaos(value: unknown): EndpointChaos {
	const data = expectRecord(value, "chaos");
	const latency = expectArray(data, "latencyMs");
	const [min, max] = latency;
	if (
		latency.length !== 2 ||
		typeof min !== "number" ||
		typeof max !== "number"
	) {
		throw new InvalidResponseError("chaos.latencyMs");
	}
	return {
		latencyMs: [min, max],
		errorRate: expectNumber(data, "errorRate"),
		errorStatus: expectNumber(data, "errorStatus"),
		timeoutRate: expectNumber(data, "timeoutRate"),
		// Absent on chaos stored before 429 injection existed.
		rateLimitRate:
			typeof data.rateLimitRate === "number" ? data.rateLimitRate : 0,
	};
}

function parseMatch(data: JsonRecord): RuleMatch {
	const source = expectString(data, "source");
	if (!isSource(source)) throw new InvalidResponseError("rule source");
	if (source === "nth") return { source };
	if (source === "body") return { source, path: expectString(data, "path") };
	return { source, key: expectString(data, "key") };
}

export function parseRule(value: unknown): EndpointRule {
	const data = expectRecord(value, "rule");
	const op = expectString(data, "op");
	if (!isOp(op)) throw new InvalidResponseError("rule op");
	const response = expectRecord(data.response, "rule response");
	const headers = expectArray(response, "headers").map((item) => {
		const header = expectRecord(item, "rule header");
		return {
			name: expectString(header, "name"),
			value: expectString(header, "value"),
		};
	});
	const { value: compared } = data;
	if (
		compared !== undefined &&
		typeof compared !== "string" &&
		typeof compared !== "number"
	) {
		throw new InvalidResponseError("rule value");
	}
	return {
		match: parseMatch(expectRecord(data.match, "rule match")),
		op,
		...(compared === undefined ? {} : { value: compared }),
		response: {
			status: expectNumber(response, "status"),
			headers,
			...(response.body === undefined ? {} : { body: response.body }),
		},
	};
}
