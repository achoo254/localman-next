import { IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { fetchAccountUsage } from "../../subscription/account-usage-api";
import { useSubscriptionDialogs } from "../../subscription/use-subscription-dialogs";

/**
 * "See plans" under a `MONTHLY_QUOTA_EXCEEDED` proxy error: opens the
 * plans modal on the proxy quota. Same usage query as the status bar.
 */
export function QuotaPlansAction() {
	const t = useT();
	const usage = useQuery({
		queryKey: ["account", "usage", "api-client"],
		queryFn: fetchAccountUsage,
		staleTime: 60_000,
	});
	const dialogs = useSubscriptionDialogs(usage.data?.plan ?? "free");
	return (
		<>
			<Button
				variant="primary"
				data-id="response-quota-plans"
				onClick={() => dialogs.openPlans("proxy")}
			>
				<IconSparkles size={16} aria-hidden="true" />
				{t("apiClientRouting.quota.plans")}
			</Button>
			{dialogs.element}
		</>
	);
}
