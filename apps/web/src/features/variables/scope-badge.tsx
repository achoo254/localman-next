import type { VariableCandidate } from "@localman/shared/api-client";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import type { SuggestionScope } from "./variable-kinds";

const TONE: Record<SuggestionScope, BadgeTone> = {
	global: "neutral",
	collection: "info",
	environment: "primary",
	temporary: "warning",
	dynamic: "accent",
};

/** Where a variable's value comes from, in the colour of its scope. */
export function ScopeBadge({ scope }: { scope: SuggestionScope }) {
	const t = useT();
	return (
		<Badge tone={TONE[scope]} data-scope={scope}>
			{t(`variables.scope.${scope}`)}
		</Badge>
	);
}

export const SECRET_MASK = "••••••";

/**
 * A candidate's value as the card shows it: masked when secret, a muted
 * label when withheld, missing or empty.
 */
export function shownValue(
	candidate: VariableCandidate,
	t: Translate,
): { text: string; muted: boolean } {
	if (candidate.locked) {
		const key = candidate.unreadable
			? "variables.tooltip.unreadableValue"
			: "variables.tooltip.lockedValue";
		return { text: t(key), muted: true };
	}
	if (candidate.withheld) {
		return { text: t("variables.tooltip.withheld"), muted: true };
	}
	if (candidate.value === null) {
		return { text: t("variables.tooltip.noValue"), muted: true };
	}
	if (candidate.secret) return { text: SECRET_MASK, muted: false };
	if (candidate.value === "") {
		return { text: t("variables.tooltip.empty"), muted: true };
	}
	return { text: candidate.value, muted: false };
}
