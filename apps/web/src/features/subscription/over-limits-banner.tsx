import type { PlanId } from "@localman/shared/constants";
import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";
import type { OverLimit } from "./account-usage-api";

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;

export interface OverLimitsBannerProps {
	plan: PlanId;
	overLimits: OverLimit[];
}

/**
 * Which limits of the plan in force the account is above (typically after
 * a Pro trial): nothing is removed, only creating more is refused.
 */
export function OverLimitsBanner({ plan, overLimits }: OverLimitsBannerProps) {
	const t = useT();
	if (overLimits.length === 0) return null;
	const list = overLimits
		.map(({ limit, used, max }) =>
			limit === "projects"
				? t("trial.overLimits.projects", { used, max })
				: t("trial.overLimits.resources", { used, max }),
		)
		.join(t("trial.overLimits.separator"));
	return (
		<Alert
			tone="warning"
			data-id="account-over-limits"
			title={t("trial.overLimits.title", { plan: PLAN_NAME[plan], list })}
		>
			{t("trial.overLimits.body")}
		</Alert>
	);
}
