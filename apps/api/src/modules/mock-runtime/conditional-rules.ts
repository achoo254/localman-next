import {
	type EndpointRule,
	MAX_REGEX_INPUT,
	type RuleMatch,
	type RuleOp,
	parseJsonPath,
	readJsonPath,
	unsafeRegexReason,
} from "@localman/shared/endpoint-behavior";

/** What rules read of a request (REST call or MCP tool call). */
export interface RuleRequest {
	/** Lowercase names as Node gives them; `null` over MCP (no headers). */
	readonly headers: Readonly<Record<string, unknown>> | null;
	readonly query: Readonly<Record<string, unknown>>;
	readonly body: unknown;
	/** This request's position among the endpoint's requests, from 1. */
	readonly nth: number;
}

const MAX_CACHED_PATTERNS = 500;
const patterns = new Map<string, RegExp | null>();

/**
 * The compiled pattern, `null` when it is unsafe (`unsafeRegexReason`,
 * checked again because stored data may predate a tighter rule).
 */
export function compileRulePattern(pattern: string): RegExp | null {
	const cached = patterns.get(pattern);
	if (cached !== undefined) return cached;
	const compiled =
		unsafeRegexReason(pattern) === null ? new RegExp(pattern, "u") : null;
	if (patterns.size >= MAX_CACHED_PATTERNS) patterns.clear();
	patterns.set(pattern, compiled);
	return compiled;
}

function ownValue(record: Readonly<Record<string, unknown>>, key: string) {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** The value `match` reads, `undefined` when the request lacks it. */
function actualOf(match: RuleMatch, request: RuleRequest): unknown {
	switch (match.source) {
		case "header":
			return request.headers === null
				? undefined
				: ownValue(request.headers, match.key);
		case "query":
			return ownValue(request.query, match.key);
		case "body": {
			const steps = parseJsonPath(match.path);
			return steps === null ? undefined : readJsonPath(request.body, steps);
		}
		case "nth":
			return request.nth;
	}
}

function textOf(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return value === null ? "null" : null;
}

function numberOf(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Numbers compare as numbers when either side is a number (`"10"` eq
 * `10`); everything else compares as text (`true` eq `"true"`). Objects
 * and arrays never equal a value.
 */
function equals(actual: unknown, expected: string | number): boolean {
	if (typeof actual === "number" || typeof expected === "number") {
		const left = numberOf(actual);
		return left !== null && left === numberOf(expected);
	}
	return textOf(actual) === expected;
}

function passes(
	op: RuleOp,
	actual: unknown,
	expected: string | number | undefined,
): boolean {
	if (op === "exists") return actual !== undefined;
	if (expected === undefined) return false;
	if (op === "neq") return !equals(actual, expected);
	if (actual === undefined) return false;
	switch (op) {
		case "eq":
			return equals(actual, expected);
		case "contains": {
			if (Array.isArray(actual)) {
				return actual.some((item) => equals(item, expected));
			}
			return textOf(actual)?.includes(String(expected)) ?? false;
		}
		case "regex": {
			const text = textOf(actual);
			if (text === null || text.length > MAX_REGEX_INPUT) return false;
			return compileRulePattern(String(expected))?.test(text) ?? false;
		}
		case "gt":
		case "lt": {
			const left = numberOf(actual);
			const right = numberOf(expected);
			if (left === null || right === null) return false;
			return op === "gt" ? left > right : left < right;
		}
	}
}

/**
 * Whether `rule` matches `request`. A missing value only passes `neq`.
 * Over MCP there are no headers at all, so a `header` rule never matches,
 * whatever its op: `neq admin` must not let every tool call through.
 */
export function ruleMatches(rule: EndpointRule, request: RuleRequest): boolean {
	if (rule.match.source === "header" && request.headers === null) return false;
	return passes(rule.op, actualOf(rule.match, request), rule.value);
}

/** The first rule that matches, in order, or `null`. */
export function firstMatchingRule(
	rules: readonly EndpointRule[] | undefined,
	request: RuleRequest,
): EndpointRule | null {
	return rules?.find((rule) => ruleMatches(rule, request)) ?? null;
}

/**
 * Requests per endpoint, for `nth` rules. In memory (one process, like
 * the rate limits): a restart starts over. Least recently used keys are
 * dropped past `maxKeysPerProject` in a project, so one project cannot
 * push the others' counts out, and past `maxKeys` in all.
 */
export class RequestCounter {
	/** Counts per key, per project; both in least recently used order. */
	private readonly projects = new Map<string, Map<string, number>>();
	private size = 0;

	constructor(
		private readonly maxKeys = 10_000,
		private readonly maxKeysPerProject = 500,
	) {}

	/** Counts one request of `key` in `project`; its position, from 1. */
	next(project: string, key: string): number {
		const counts = this.projects.get(project) ?? new Map<string, number>();
		this.projects.delete(project);
		this.projects.set(project, counts);
		const count = (counts.get(key) ?? 0) + 1;
		if (!counts.delete(key)) this.size += 1;
		counts.set(key, count);
		if (counts.size > this.maxKeysPerProject) this.dropOldest(project, counts);
		while (this.size > this.maxKeys) {
			const oldest = this.projects.entries().next();
			if (oldest.done) break;
			this.dropOldest(...oldest.value);
		}
		return count;
	}

	/** Forgets the counts of `project` (every project without one). */
	reset(project?: string): void {
		if (project === undefined) {
			this.projects.clear();
			this.size = 0;
			return;
		}
		this.size -= this.projects.get(project)?.size ?? 0;
		this.projects.delete(project);
	}

	private dropOldest(project: string, counts: Map<string, number>): void {
		const oldest = counts.keys().next();
		if (!oldest.done) {
			counts.delete(oldest.value);
			this.size -= 1;
		}
		if (counts.size === 0) this.projects.delete(project);
	}
}
