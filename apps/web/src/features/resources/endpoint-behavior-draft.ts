import type {
	EndpointChaos,
	EndpointRule,
	RuleOp,
	RuleSource,
} from "./endpoint-behavior-model";

/** Chaos as typed: rates in percent, every value as text. */
export interface ChaosDraft {
	min: string;
	max: string;
	errorRate: string;
	errorStatus: string;
	timeoutRate: string;
	rateLimitRate: string;
}

export interface RuleDraft {
	/** Stable React key; not sent. */
	key: string;
	source: RuleSource;
	/** Header name, query parameter or JSONPath; unused for `nth`. */
	target: string;
	op: RuleOp;
	value: string;
	/**
	 * The saved value was a number (`eq 10`, set over MCP or the API): it
	 * stays a number while the text still reads as one.
	 */
	valueIsNumber: boolean;
	status: string;
	/** JSON object of header names and values; empty for none. */
	headers: string;
	/** Body template as JSON text; empty means `"$mockData"`. */
	body: string;
	/** Expanded in the editor; only open rules mount their JSON editors. */
	open: boolean;
}

/** Statuses offered for chaos errors (reason phrases are not translated). */
export const CHAOS_STATUSES: ReadonlyArray<readonly [number, string]> = [
	[400, "Bad Request"],
	[401, "Unauthorized"],
	[403, "Forbidden"],
	[404, "Not Found"],
	[409, "Conflict"],
	[422, "Unprocessable Content"],
	[500, "Internal Server Error"],
	[502, "Bad Gateway"],
	[503, "Service Unavailable"],
	[504, "Gateway Timeout"],
];

export const NO_CHAOS: ChaosDraft = Object.freeze({
	min: "0",
	max: "0",
	errorRate: "0",
	errorStatus: "500",
	timeoutRate: "0",
	rateLimitRate: "0",
});

/** 0.1 → "10", without float noise (0.07 → "7", not "7.000000000000001"). */
const percent = (rate: number): string =>
	String(Math.round(rate * 10_000) / 100);

export function chaosDraftOf(chaos: EndpointChaos | undefined): ChaosDraft {
	if (!chaos) return NO_CHAOS;
	return {
		min: String(chaos.latencyMs[0]),
		max: String(chaos.latencyMs[1]),
		errorRate: percent(chaos.errorRate),
		errorStatus: String(chaos.errorStatus),
		timeoutRate: percent(chaos.timeoutRate),
		rateLimitRate: percent(chaos.rateLimitRate),
	};
}

/** Text of a chaos field as a number; empty counts as 0. */
export function chaosNumber(text: string): number {
	return text.trim() === "" ? 0 : Number(text);
}

/** Chaos only changes something with a delay or a non-zero rate. */
export function chaosIsOn(chaos: ChaosDraft): boolean {
	return [
		chaos.min,
		chaos.max,
		chaos.errorRate,
		chaos.timeoutRate,
		chaos.rateLimitRate,
	].some((text) => chaosNumber(text) !== 0);
}

/** API value of a checked draft; `undefined` turns chaos off. */
export function chaosOf(chaos: ChaosDraft): EndpointChaos | undefined {
	if (!chaosIsOn(chaos)) return undefined;
	return {
		latencyMs: [chaosNumber(chaos.min), chaosNumber(chaos.max)],
		errorRate: chaosNumber(chaos.errorRate) / 100,
		errorStatus: Number(chaos.errorStatus),
		timeoutRate: chaosNumber(chaos.timeoutRate) / 100,
		rateLimitRate: chaosNumber(chaos.rateLimitRate) / 100,
	};
}

let lastRuleKey = 0;
const newRuleKey = (): string => {
	lastRuleKey += 1;
	return `rule-${lastRuleKey}`;
};

/** A saved rule (collapsed) or a new one: header equals, status 200, open. */
export function ruleDraft(rule?: EndpointRule): RuleDraft {
	if (!rule) {
		return {
			key: newRuleKey(),
			source: "header",
			target: "",
			op: "eq",
			value: "",
			valueIsNumber: false,
			status: "200",
			headers: "",
			body: "",
			open: true,
		};
	}
	const { match, response } = rule;
	const headers = Object.fromEntries(
		response.headers.map((header) => [header.name, header.value]),
	);
	return {
		key: newRuleKey(),
		source: match.source,
		target:
			match.source === "body"
				? match.path
				: match.source === "nth"
					? ""
					: match.key,
		op: rule.op,
		value: rule.value === undefined ? "" : String(rule.value),
		valueIsNumber: typeof rule.value === "number",
		status: String(response.status),
		headers:
			response.headers.length > 0 ? JSON.stringify(headers, null, 2) : "",
		body:
			response.body === undefined ? "" : JSON.stringify(response.body, null, 2),
		open: false,
	};
}

/** Operators a source accepts: a request number is only compared. */
export function opsFor(source: RuleSource): readonly RuleOp[] {
	return source === "nth"
		? ["eq", "neq", "gt", "lt"]
		: ["eq", "neq", "contains", "regex", "exists", "gt", "lt"];
}

/** The value is a number for `gt`, `lt` and every request-number rule. */
export function numericValue(rule: Pick<RuleDraft, "source" | "op">): boolean {
	return rule.source === "nth" || rule.op === "gt" || rule.op === "lt";
}

/** The value to send: a number where one is compared or was saved. */
export function ruleValueOf(rule: RuleDraft): string | number {
	const text = rule.value;
	const isNumber = text.trim() !== "" && Number.isFinite(Number(text));
	return numericValue(rule) || (rule.valueIsNumber && isNumber)
		? Number(text)
		: text;
}
