import {
	HEADER_NAME_PATTERN,
	HEADER_VALUE_PATTERN,
	MAX_REGEX_LENGTH,
	MAX_RULE_HEADERS,
	MAX_RULE_HEADER_VALUE_LENGTH,
	MAX_RULE_KEY_LENGTH,
	MAX_RULE_VALUE_LENGTH,
	type RuleHeaderIssue,
	parseJsonPath,
	ruleHeaderIssue,
	unsafeRegexReason,
} from "@localman/shared/endpoint-behavior";
import type { Translate } from "../../i18n/translate";
import { isRecord } from "../../lib/json-guards";
import { parseJsonText } from "../../lib/json-text";
import { type RuleDraft, numericValue } from "./endpoint-behavior-draft";
import type { RuleHeader } from "./endpoint-behavior-model";

/* Checks of the fields of one conditional rule, with the API's own rules. */

export function targetError(rule: RuleDraft, t: Translate): string | undefined {
	const target = rule.target.trim();
	if (rule.source === "nth") return undefined;
	if (rule.source === "body") {
		return parseJsonPath(target) === null
			? t("resourceRules.errors.jsonPath")
			: undefined;
	}
	if (target === "") {
		return rule.source === "header"
			? t("resourceRules.errors.keyRequiredHeader")
			: t("resourceRules.errors.keyRequiredQuery");
	}
	if (target.length > MAX_RULE_KEY_LENGTH) {
		return t("resourceRules.errors.tooLong", { max: MAX_RULE_KEY_LENGTH });
	}
	if (rule.source === "header" && !HEADER_NAME_PATTERN.test(target)) {
		return t("resourceRules.errors.headerName");
	}
	return undefined;
}

export function valueError(rule: RuleDraft, t: Translate): string | undefined {
	const { value } = rule;
	if (rule.source !== "nth" && rule.op === "exists") return undefined;
	if (value.trim() === "") return t("resourceRules.errors.valueRequired");
	if (rule.source === "nth") {
		const n = Number(value);
		return Number.isInteger(n) && n >= 1
			? undefined
			: t("resourceRules.errors.nth");
	}
	if (numericValue(rule)) {
		return Number.isFinite(Number(value))
			? undefined
			: t("resourceRules.errors.number");
	}
	if (value.length > MAX_RULE_VALUE_LENGTH) {
		return t("resourceRules.errors.tooLong", { max: MAX_RULE_VALUE_LENGTH });
	}
	if (rule.op !== "regex") return undefined;
	if (value.length > MAX_REGEX_LENGTH) {
		return t("resourceRules.errors.tooLong", { max: MAX_REGEX_LENGTH });
	}
	try {
		new RegExp(value, "u");
	} catch {
		return t("resourceRules.errors.regex");
	}
	return unsafeRegexReason(value) === null
		? undefined
		: t("resourceRules.errors.regexUnsafe");
}

function headerIssueText(
	issue: RuleHeaderIssue,
	name: string,
	t: Translate,
): string {
	switch (issue) {
		case "reserved":
			return t("resourceRules.errors.headerReserved", { name });
		case "location":
			return t("resourceRules.errors.headerLocation");
		case "contentType":
			return t("resourceRules.errors.headerContentType");
	}
}

/**
 * Headers of the JSON object text for a rule answering `status`, or the
 * message explaining why not.
 */
export function readHeaders(
	text: string,
	status: number,
	t: Translate,
): RuleHeader[] | string {
	if (text.trim() === "") return [];
	const parsed = parseJsonText(text);
	if (!parsed.ok || !isRecord(parsed.value))
		return t("resourceRules.errors.headers");
	const entries = Object.entries(parsed.value);
	if (entries.length > MAX_RULE_HEADERS) {
		return t("resourceRules.errors.headersMax", { max: MAX_RULE_HEADERS });
	}
	const headers: RuleHeader[] = [];
	for (const [raw, value] of entries) {
		const name = raw.toLowerCase();
		if (typeof value !== "string" || !HEADER_NAME_PATTERN.test(raw)) {
			return t("resourceRules.errors.headers");
		}
		if (headers.some((header) => header.name === name)) {
			return t("resourceRules.errors.headers");
		}
		if (
			value.length > MAX_RULE_HEADER_VALUE_LENGTH ||
			!HEADER_VALUE_PATTERN.test(value)
		) {
			return t("resourceRules.errors.headerValue", {
				name,
				max: MAX_RULE_HEADER_VALUE_LENGTH,
			});
		}
		const issue = ruleHeaderIssue(name, value, status);
		if (issue !== null) return headerIssueText(issue, name, t);
		headers.push({ name, value });
	}
	return headers;
}
