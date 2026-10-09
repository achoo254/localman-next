/**
 * Suggests a whitelisted Faker method for a field from its name and type
 * (`email` → `internet.email`, `so_dien_thoai` → `phone.number`). The
 * suggestion is advice: the UI shows it and the user may pick another
 * method. Rules live in `faker-field-rules.ts`; method output types in
 * `faker-method-kinds.ts`. Zod- and Faker-free (light entry point).
 */
import {
	FAKER_FIELD_RULES,
	type FakerFieldRule,
	type FieldRulePlace,
} from "./faker-field-rules.js";
import { type FakerMethodKind, fakerMethodKind } from "./faker-method-kinds.js";
import { type NameRun, fieldNameTokens, nameRuns } from "./faker-name-runs.js";
import type { FieldType } from "./resource-constants.js";

/** Value type the method must produce; `any` for a Faker.js field. */
export type FakerValueKind = "any" | "string" | "number" | "boolean" | "date";

export interface FakerFieldMatch {
	/** Whitelisted `category.method`. */
	readonly method: string;
	/** One of `FAKER_MATCH_CONFIDENCE`: higher is a closer name match. */
	readonly confidence: number;
}

/**
 * Whole name (`email`), a run at its start or end (`userEmail`,
 * `avatarUrl`), or a run inside it (`mainPhoneNumberValue`).
 */
export const FAKER_MATCH_CONFIDENCE = Object.freeze({
	exact: 0.95,
	edge: 0.75,
	contains: 0.5,
});

/** Shortest piece of an unsplit name (`useremail`) worth matching. */
const MIN_LOOSE_LENGTH = 5;

const FITS: Readonly<Record<FakerValueKind, readonly FakerMethodKind[]>> = {
	any: ["string", "date", "number", "boolean", "number-array", "object"],
	// ISO dates are strings, so a String `createdAt` may hold `date.past`.
	string: ["string", "date"],
	number: ["number"],
	boolean: ["boolean"],
	date: ["date"],
};

const FIELD_KINDS: Partial<Record<FieldType, FakerValueKind>> = {
	"Faker.js": "any",
	String: "string",
	Number: "number",
	Boolean: "boolean",
	Date: "date",
};

/** Kind to match for a schema field type; `null` when Faker cannot fill it. */
export function fakerValueKindOf(type: FieldType): FakerValueKind | null {
	return FIELD_KINDS[type] ?? null;
}

interface CompiledRule {
	readonly rule: FakerFieldRule;
	readonly whole: RegExp;
	readonly head: RegExp;
	readonly tail: RegExp;
}

const RULES: readonly CompiledRule[] = FAKER_FIELD_RULES.map((rule) => ({
	rule,
	whole: new RegExp(`^(?:${rule.pattern})$`),
	head: new RegExp(`^(?:${rule.pattern})`),
	tail: new RegExp(`(?:${rule.pattern})$`),
}));
const ANY_PATTERN = FAKER_FIELD_RULES.map((rule) => `(?:${rule.pattern})`).join(
	"|",
);
/** Whether any rule matches a whole run: most runs match none. */
const ANY_RULE = new RegExp(`^(?:${ANY_PATTERN})$`);
/** Whether any rule matches the start or the end of an unsplit name. */
const ANY_HEAD = new RegExp(`^(?:${ANY_PATTERN})`);
const ANY_TAIL = new RegExp(`(?:${ANY_PATTERN})$`);

/** Each rule with the first of its methods that fits a kind, in rule order. */
const rulesByKind = new Map<
	FakerValueKind,
	readonly { readonly compiled: CompiledRule; readonly method: string }[]
>();

function rulesFor(kind: FakerValueKind) {
	const known = rulesByKind.get(kind);
	if (known) return known;
	const fits = FITS[kind];
	const rules = RULES.flatMap((compiled) => {
		const method = compiled.rule.methods.find((id) =>
			fits.includes(fakerMethodKind(id)),
		);
		return method === undefined ? [] : [{ compiled, method }];
	});
	rulesByKind.set(kind, rules);
	return rules;
}

interface Candidate {
	readonly score: number;
	/** Characters matched: the longer run is the more specific rule. */
	readonly length: number;
}

function better(a: Candidate, b: Candidate | null): boolean {
	return (
		b === null ||
		a.score > b.score ||
		(a.score === b.score && a.length > b.length)
	);
}

function allowedAt(
	place: FieldRulePlace | undefined,
	atStart: boolean,
	atEnd: boolean,
): boolean {
	if (place === "exact") return atStart && atEnd;
	if (place === "start") return atStart;
	if (place === "end") return atEnd;
	return true;
}

function scoreAt(atStart: boolean, atEnd: boolean): number {
	if (atStart && atEnd) return FAKER_MATCH_CONFIDENCE.exact;
	return atStart || atEnd
		? FAKER_MATCH_CONFIDENCE.edge
		: FAKER_MATCH_CONFIDENCE.contains;
}

/** Best run of the name a rule matches, or `null`. */
function tokenMatch(
	{ rule, whole }: CompiledRule,
	runs: readonly NameRun[],
): Candidate | null {
	let best: Candidate | null = null;
	for (const { text, atStart, atEnd } of runs) {
		if (!allowedAt(rule.place, atStart, atEnd) || !whole.test(text)) continue;
		const candidate = { score: scoreAt(atStart, atEnd), length: text.length };
		if (better(candidate, best)) best = candidate;
	}
	return best;
}

/** A run at the start or end of a name written without separators. */
function looseMatch(
	{ rule, head, tail }: CompiledRule,
	key: string,
): Candidate | null {
	if (rule.place === "exact") return null;
	const pieces = [
		rule.place === "end" ? undefined : head.exec(key)?.[0],
		rule.place === "start" ? undefined : tail.exec(key)?.[0],
	];
	const length = Math.max(0, ...pieces.map((piece) => piece?.length ?? 0));
	return length >= MIN_LOOSE_LENGTH
		? { score: FAKER_MATCH_CONFIDENCE.contains, length }
		: null;
}

/**
 * The best whitelisted method for a field, or `null` when no rule fits.
 * Exact names beat runs at the start or end, which beat runs inside; then
 * the longer match wins, then the earlier rule. Only methods whose output
 * fits `kind` are considered (a Number field never gets a string method).
 */
export function matchFakerField(
	name: string,
	kind: FakerValueKind = "any",
): FakerFieldMatch | null {
	const tokens = fieldNameTokens(name);
	if (tokens.length === 0) return null;
	const runs = nameRuns(tokens, (text) => ANY_RULE.test(text));
	const [only] = tokens;
	const key =
		tokens.length === 1 &&
		only !== undefined &&
		(ANY_HEAD.test(only) || ANY_TAIL.test(only))
			? only
			: null;
	let best: (Candidate & { readonly method: string }) | null = null;
	for (const { compiled, method } of rulesFor(kind)) {
		const found =
			tokenMatch(compiled, runs) ??
			(key === null ? null : looseMatch(compiled, key));
		if (found !== null && better(found, best)) best = { ...found, method };
	}
	return best === null ? null : { method: best.method, confidence: best.score };
}
