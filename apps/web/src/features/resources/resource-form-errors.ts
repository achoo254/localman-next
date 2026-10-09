import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";
import {
	type BehaviorErrors,
	type ChaosPart,
	type DraftErrors,
	type ResourceDraft,
	type RulePart,
	endpointKey,
} from "./resource-form-state";

const CHAOS_PARTS: Readonly<Record<string, ChaosPart>> = {
	"latencyMs.0": "min",
	"latencyMs.1": "max",
	latencyMs: "max",
	errorRate: "errorRate",
	timeoutRate: "timeoutRate",
	rateLimitRate: "rateLimitRate",
	"": "rates",
};

/** First segment of a rule issue path → the field showing it. */
const RULE_PARTS: Readonly<Record<string, RulePart>> = {
	match: "target",
	op: "value",
	value: "value",
	"response.status": "status",
	"response.headers": "headers",
	"response.body": "body",
};

function rulePart(rest: string): RulePart {
	for (const [prefix, part] of Object.entries(RULE_PARTS)) {
		if (rest === prefix || rest.startsWith(`${prefix}.`)) return part;
	}
	return "value";
}

function behaviorOf(errors: DraftErrors, key: string): BehaviorErrors {
	const existing = errors.behavior[key];
	if (existing) return existing;
	const created: BehaviorErrors = { chaos: {}, rules: {} };
	errors.behavior[key] = created;
	return created;
}

/**
 * Errors of a 400 VALIDATION_ERROR on an endpoint's chaos or rules
 * (`endpoints.2.rules.0.value`), placed on the field that holds the
 * value; `null` when the API blames something else.
 */
export function serverBehaviorErrors(
	error: unknown,
	draft: ResourceDraft,
	t: Translate,
): DraftErrors | null {
	if (!(error instanceof ApiError) || error.code !== "VALIDATION_ERROR") {
		return null;
	}
	if (!Array.isArray(error.details)) return null;
	const errors: DraftErrors = { fields: {}, endpoints: {}, behavior: {} };
	let placed = false;
	for (const issue of error.details) {
		if (!isRecord(issue) || typeof issue.path !== "string") continue;
		const found = /^endpoints\.(\d+)\.(chaos|rules)(?:\.(.*))?$/.exec(
			issue.path,
		);
		const endpoint = draft.endpoints[Number(found?.[1])];
		if (!found || !endpoint) continue;
		const message = t("resourceRules.errors.server", {
			message: typeof issue.message === "string" ? issue.message : "",
		});
		const behavior = behaviorOf(errors, endpointKey(endpoint));
		const rest = found[3] ?? "";
		if (found[2] === "chaos") {
			behavior.chaos[CHAOS_PARTS[rest] ?? "rates"] ??= message;
			placed = true;
			continue;
		}
		const rule = /^(\d+)(?:\.(.*))?$/.exec(rest);
		const target = endpoint.rules[Number(rule?.[1])];
		if (!rule || !target) continue;
		const ruleErrors = behavior.rules[target.key] ?? {};
		ruleErrors[rulePart(rule[2] ?? "")] ??= message;
		behavior.rules[target.key] = ruleErrors;
		placed = true;
	}
	return placed ? errors : null;
}

/**
 * The draft with every endpoint panel and rule holding an error opened
 * (rules first, the order the mock runs them), so the error can be seen
 * and focused.
 */
export function revealErrors(
	draft: ResourceDraft,
	errors: DraftErrors,
): ResourceDraft {
	return {
		...draft,
		endpoints: draft.endpoints.map((endpoint) => {
			const found = errors.behavior[endpointKey(endpoint)];
			if (!found) return endpoint;
			const ruleKeys = Object.keys(found.rules);
			const panel =
				ruleKeys.length > 0
					? "rules"
					: Object.keys(found.chaos).length > 0
						? "chaos"
						: endpoint.panel;
			return {
				...endpoint,
				panel,
				rules: endpoint.rules.map((rule) =>
					ruleKeys.includes(rule.key) ? { ...rule, open: true } : rule,
				),
			};
		}),
	};
}

/** Whether any part of the form is marked invalid. */
export function hasDraftErrors(errors: DraftErrors): boolean {
	return (
		errors.name !== undefined ||
		errors.schema !== undefined ||
		errors.template !== undefined ||
		Object.keys(errors.fields).length > 0 ||
		Object.keys(errors.endpoints).length > 0 ||
		Object.keys(errors.behavior).length > 0
	);
}
