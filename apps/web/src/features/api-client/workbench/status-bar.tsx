import { useQuery } from "@tanstack/react-query";
import { useI18n, useT } from "../../../i18n/i18n-context";
import { fetchAccountUsage } from "../../subscription/account-usage-api";
import { useWorkbenchState } from "./workbench-context";

/** Bottom line: draft sync state and this month's proxy requests. */
export function StatusBar() {
	const t = useT();
	const { formatNumber } = useI18n();
	const { syncStatus } = useWorkbenchState();
	const usage = useQuery({
		queryKey: ["account", "usage", "api-client"],
		queryFn: fetchAccountUsage,
		staleTime: 60_000,
	});
	const proxy = usage.data?.proxyRequests;

	return (
		<div
			data-id="statusbar"
			className="flex min-h-8 flex-none flex-wrap items-center gap-x-4 gap-y-1 border-border-subtle border-t bg-surface px-3 py-1 font-mono text-muted text-xs"
		>
			<output
				data-id="statusbar-draft"
				className={syncStatus.state === "error" ? "text-error-text" : undefined}
			>
				{syncStatus.state === "error"
					? syncStatus.message
					: t(`apiClient.status.draft.${syncStatus.state}`)}
			</output>
			{proxy ? (
				<span data-id="statusbar-proxy-quota">
					{proxy.max === null
						? t("apiClient.status.proxyUnlimited")
						: t("apiClient.status.proxyUsed", {
								used: formatNumber(Math.min(proxy.used, proxy.max)),
								max: formatNumber(proxy.max),
							})}
				</span>
			) : null}
			<span className="ml-auto max-md:hidden">
				{t("apiClient.status.shortcuts")}
			</span>
		</div>
	);
}
