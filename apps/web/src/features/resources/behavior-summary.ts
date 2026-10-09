import type { Translate } from "../../i18n/translate";
import {
	type ChaosDraft,
	type RuleDraft,
	chaosNumber,
} from "./endpoint-behavior-draft";

/** "200–1,500 ms · 10% errors (503) · 5% timeouts", parts at 0 left out. */
export function chaosSummary(chaos: ChaosDraft, t: Translate): string {
	const min = chaosNumber(chaos.min);
	const max = chaosNumber(chaos.max);
	const parts: string[] = [];
	if (max > 0) parts.push(t("resourceChaos.summaryDelay", { min, max }));
	const errors = chaosNumber(chaos.errorRate);
	if (errors > 0) {
		parts.push(
			t("resourceChaos.summaryErrors", {
				rate: errors,
				status: chaos.errorStatus,
			}),
		);
	}
	const limited = chaosNumber(chaos.rateLimitRate);
	if (limited > 0) {
		parts.push(t("resourceChaos.summaryRateLimit", { rate: limited }));
	}
	const timeouts = chaosNumber(chaos.timeoutRate);
	if (timeouts > 0) {
		parts.push(t("resourceChaos.summaryTimeouts", { rate: timeouts }));
	}
	return parts.join(" · ");
}

/**
 * One line for a collapsed rule, from translated parts:
 * `header x-role equals "admin" → 403`; `null` while a part is missing.
 */
export function ruleSummary(rule: RuleDraft, t: Translate): string | null {
	const target = rule.target.trim();
	const exists = rule.source !== "nth" && rule.op === "exists";
	if (rule.source !== "nth" && target === "") return null;
	if (!exists && rule.value.trim() === "") return null;
	if (rule.status.trim() === "") return null;
	const value =
		rule.source === "nth" || rule.op === "gt" || rule.op === "lt"
			? rule.value.trim()
			: `"${rule.value}"`;
	return [
		t(`resourceRules.summarySources.${rule.source}`),
		rule.source === "nth" ? null : target,
		t(`resourceRules.ops.${rule.op}`),
		exists ? null : value,
		"→",
		rule.status.trim(),
	]
		.filter((part) => part !== null)
		.join(" ");
}
