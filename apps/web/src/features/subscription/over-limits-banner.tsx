import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";
import type { OverLimit } from "./account-usage-api";

export interface OverLimitsBannerProps {
	overLimits: OverLimit[];
}

/**
 * Which limits the account is above (typically once its extended limits
 * have ended): nothing is removed, only creating more is refused.
 */
export function OverLimitsBanner({ overLimits }: OverLimitsBannerProps) {
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
			title={t("trial.overLimits.title", { list })}
		>
			{t("trial.overLimits.body")}
		</Alert>
	);
}
