import { MAX_CHAOS_DELAY_MS } from "@localman/shared/endpoint-behavior";
import type { Translate } from "../../i18n/translate";
import { parseJsonText } from "../../lib/json-text";
import {
	type ChaosDraft,
	type RuleDraft,
	chaosNumber,
	chaosOf,
	ruleValueOf,
} from "./endpoint-behavior-draft";
import type {
	EndpointChaos,
	EndpointRule,
	RuleMatch,
} from "./endpoint-behavior-model";
import type {
	BehaviorErrors,
	ChaosPart,
	EndpointDraft,
	RulePart,
} from "./resource-form-state";
import { readHeaders, targetError, valueError } from "./rule-field-checks";

const MIN_RULE_STATUS = 200;
const MAX_RULE_STATUS = 599;

type ChaosErrors = Partial<Record<ChaosPart, string>>;
type RuleErrors = Partial<Record<RulePart, string>>;

function chaosErrors(chaos: ChaosDraft, t: Translate): ChaosErrors {
	const errors: ChaosErrors = {};
	for (const part of ["min", "max"] as const) {
		const ms = chaosNumber(chaos[part]);
		if (!Number.isInteger(ms) || ms < 0 || ms > MAX_CHAOS_DELAY_MS) {
			errors[part] = t("resourceChaos.errors.delayRange", {
				max: MAX_CHAOS_DELAY_MS,
			});
		}
	}
	if (
		!errors.min &&
		!errors.max &&
		chaosNumber(chaos.min) > chaosNumber(chaos.max)
	) {
		errors.max = t("resourceChaos.errors.delayOrder");
	}
	const rates = ["errorRate", "rateLimitRate", "timeoutRate"] as const;
	for (const part of rates) {
		const value = chaosNumber(chaos[part]);
		if (!Number.isFinite(value) || value < 0 || value > 100) {
			errors[part] = t("resourceChaos.errors.rate");
		}
	}
	const sum = rates.reduce(
		(total, part) => total + chaosNumber(chaos[part]),
		0,
	);
	if (rates.every((part) => !errors[part]) && sum > 100 + 1e-9) {
		errors.rates = t("resourceChaos.errors.rateSum");
	}
	return errors;
}

function matchOf(rule: RuleDraft): RuleMatch {
	const target = rule.target.trim();
	if (rule.source === "nth") return { source: "nth" };
	if (rule.source === "body") return { source: "body", path: target };
	return { source: rule.source, key: target };
}

function checkRule(
	rule: RuleDraft,
	t: Translate,
): { rule: EndpointRule | null; errors: RuleErrors } {
	const errors: RuleErrors = {};
	const target = targetError(rule, t);
	if (target) errors.target = target;
	const value = valueError(rule, t);
	if (value) errors.value = value;
	const status = Number(rule.status);
	if (
		!Number.isInteger(status) ||
		status < MIN_RULE_STATUS ||
		status > MAX_RULE_STATUS
	) {
		errors.status = t("resourceRules.errors.status", {
			min: MIN_RULE_STATUS,
			max: MAX_RULE_STATUS,
		});
	}
	const headers = readHeaders(rule.headers, status, t);
	if (typeof headers === "string") errors.headers = headers;
	const body = rule.body.trim() === "" ? null : parseJsonText(rule.body);
	if (body && !body.ok) errors.body = t("resources.validation.responseInvalid");
	if (Object.keys(errors).length > 0 || typeof headers === "string") {
		return { rule: null, errors };
	}
	const exists = rule.source !== "nth" && rule.op === "exists";
	return {
		rule: {
			match: matchOf(rule),
			op: rule.op,
			...(exists ? {} : { value: ruleValueOf(rule) }),
			response: {
				status,
				headers,
				...(body?.ok ? { body: body.value } : {}),
			},
		},
		errors,
	};
}

export interface CheckedBehavior {
	/** `null` when nothing is wrong. */
	errors: BehaviorErrors | null;
	chaos?: EndpointChaos;
	rules?: EndpointRule[];
}

/** Checks the chaos and rules of an endpoint like the API does. */
export function checkBehavior(
	endpoint: EndpointDraft,
	t: Translate,
): CheckedBehavior {
	const errors: BehaviorErrors = {
		chaos: chaosErrors(endpoint.chaos, t),
		rules: {},
	};
	const rules: EndpointRule[] = [];
	for (const draft of endpoint.rules) {
		const checked = checkRule(draft, t);
		if (checked.rule) rules.push(checked.rule);
		else errors.rules[draft.key] = checked.errors;
	}
	const failed =
		Object.keys(errors.chaos).length > 0 ||
		Object.keys(errors.rules).length > 0;
	if (failed) return { errors };
	const chaos = chaosOf(endpoint.chaos);
	return {
		errors: null,
		...(chaos ? { chaos } : {}),
		...(rules.length > 0 ? { rules } : {}),
	};
}
