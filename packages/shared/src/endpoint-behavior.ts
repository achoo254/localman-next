import { z } from "zod";
import { MAX_JSON_PATH_LENGTH, parseJsonPath } from "./json-path.js";
import { FORBIDDEN_KEYS, utf8Length } from "./json-value.js";
import { responseTemplateSchema } from "./response-template-schema.js";
import {
	MAX_RULE_HEADERS,
	headerNameSchema,
	ruleHeaderIssue,
	ruleHeaderSchema,
} from "./rule-headers.js";
import { unsafeRegexReason } from "./safe-regex.js";

export {
	ALLOWED_RULE_HEADERS,
	HEADER_NAME_PATTERN,
	HEADER_VALUE_PATTERN,
	MAX_RULE_HEADER_VALUE_LENGTH,
	MAX_RULE_HEADERS,
	type RuleHeaderIssue,
	isRuleHeaderName,
	ruleHeaderIssue,
} from "./rule-headers.js";
export {
	type JsonPathStep,
	MAX_JSON_PATH_LENGTH,
	MAX_JSON_PATH_STEPS,
	parseJsonPath,
	readJsonPath,
} from "./json-path.js";
export {
	MAX_REGEX_COST,
	MAX_REGEX_INPUT,
	MAX_REGEX_LENGTH,
	unsafeRegexReason,
} from "./safe-regex.js";

/** Longest latency (and timeout hold) chaos may add to one request. */
export const MAX_CHAOS_DELAY_MS = 30_000;
export const MAX_RULES_PER_ENDPOINT = 20;
export const MAX_RULE_KEY_LENGTH = 100;
export const MAX_RULE_VALUE_LENGTH = 1_000;
/** Most bytes of compact JSON the rules of one endpoint may take. */
export const MAX_RULES_BYTES = 64 * 1024;

export const RULE_SOURCES = ["header", "query", "body", "nth"] as const;
export const RULE_OPS = [
	"eq",
	"neq",
	"contains",
	"regex",
	"exists",
	"gt",
	"lt",
] as const;
export type RuleOp = (typeof RULE_OPS)[number];

const rate = z.number().min(0).max(1);
const delay = z.number().int().min(0).max(MAX_CHAOS_DELAY_MS);

/**
 * Chaos of one endpoint: a random latency in `latencyMs` (inclusive), then
 * one roll picks a timeout (held until the latency maximum, or 10 s
 * without one, then 504), a 429 with `Retry-After`, an `errorStatus`
 * error, or the normal response.
 */
export const endpointChaosSchema = z
	.object({
		latencyMs: z
			.tuple([delay, delay])
			.refine(([min, max]) => min <= max, "The minimum exceeds the maximum")
			.default([0, 0]),
		errorRate: rate.default(0),
		errorStatus: z.number().int().min(400).max(599).default(500),
		timeoutRate: rate.default(0),
		rateLimitRate: rate.default(0),
	})
	.refine(
		(chaos) =>
			chaos.errorRate + chaos.timeoutRate + chaos.rateLimitRate <= 1 + 1e-9,
		{ message: "errorRate + timeoutRate + rateLimitRate must be at most 1" },
	);
export type EndpointChaos = z.output<typeof endpointChaosSchema>;

const ruleMatchSchema = z.discriminatedUnion("source", [
	z.object({ source: z.literal("header"), key: headerNameSchema }),
	z.object({
		source: z.literal("query"),
		key: z
			.string()
			.min(1)
			.max(MAX_RULE_KEY_LENGTH)
			.refine((key) => !FORBIDDEN_KEYS.includes(key), "Forbidden key"),
	}),
	z.object({
		source: z.literal("body"),
		path: z
			.string()
			.max(MAX_JSON_PATH_LENGTH)
			.refine((path) => parseJsonPath(path) !== null, {
				message: "Use a JSONPath like $.user.role or $.items[0]['a.b']",
			}),
	}),
	z.object({ source: z.literal("nth") }),
]);
export type RuleMatch = z.output<typeof ruleMatchSchema>;

const ruleResponseSchema = z
	.object({
		status: z.number().int().min(200).max(599),
		/** Absent: `$mockData`. */
		body: responseTemplateSchema.optional(),
		headers: z
			.array(ruleHeaderSchema)
			.max(MAX_RULE_HEADERS)
			.default([])
			.refine(
				(headers) =>
					new Set(headers.map((header) => header.name)).size === headers.length,
				"A header appears more than once",
			),
	})
	.superRefine((response, ctx) => {
		for (const [index, { name, value }] of response.headers.entries()) {
			const issue = ruleHeaderIssue(name, value, response.status);
			if (issue === "location") {
				ctx.addIssue({
					code: "custom",
					path: ["headers", index, "name"],
					message: "location needs a 3xx status",
				});
			} else if (issue === "contentType") {
				ctx.addIssue({
					code: "custom",
					path: ["headers", index, "value"],
					message: "content-type must be a JSON type or text/plain",
				});
			}
		}
	});

const issueOf = (rule: {
	match: RuleMatch;
	op: RuleOp;
	value?: string | number | undefined;
}): string | null => {
	const { op, value } = rule;
	if (rule.match.source === "nth") {
		if (!["eq", "neq", "gt", "lt"].includes(op)) {
			return "nth rules compare with eq, neq, gt or lt";
		}
		return Number.isInteger(value) && Number(value) >= 1
			? null
			: "nth rules need a whole number of at least 1";
	}
	if (op === "exists")
		return value === undefined ? null : "exists takes no value";
	if (value === undefined) return `${op} needs a value`;
	if (op === "gt" || op === "lt") {
		return typeof value === "number" ? null : `${op} needs a number`;
	}
	if (op === "regex") {
		return typeof value === "string"
			? unsafeRegexReason(value)
			: "regex needs a pattern string";
	}
	return null;
};

/** One conditional response: when `match` passes `op value`, answer `response`. */
export const endpointRuleSchema = z
	.object({
		match: ruleMatchSchema,
		op: z.enum(RULE_OPS),
		value: z
			.union([z.string().max(MAX_RULE_VALUE_LENGTH), z.number()])
			.optional(),
		response: ruleResponseSchema,
	})
	.superRefine((rule, ctx) => {
		const message = issueOf(rule);
		if (message) ctx.addIssue({ code: "custom", path: ["value"], message });
	});
export type EndpointRule = z.output<typeof endpointRuleSchema>;

/** Rules of an endpoint, tried in order; the first that matches answers. */
export const endpointRulesSchema = z
	.array(endpointRuleSchema)
	.max(
		MAX_RULES_PER_ENDPOINT,
		`An endpoint has at most ${MAX_RULES_PER_ENDPOINT} rules`,
	)
	.refine(
		(rules) => utf8Length(JSON.stringify(rules)) <= MAX_RULES_BYTES,
		`The rules of an endpoint take at most ${MAX_RULES_BYTES} bytes`,
	);
