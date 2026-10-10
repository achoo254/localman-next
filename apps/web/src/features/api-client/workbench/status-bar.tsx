import { useQuery } from "@tanstack/react-query";
import { useI18n, useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { fetchAccountUsage } from "../../subscription/account-usage-api";
import { WARNING_RATIO } from "../../subscription/usage-meter";
import { useWorkbenchState } from "./workbench-context";

/** Thin divider between status items, as in the prototype. */
function Separator() {
	return (
		<span aria-hidden="true" className="h-3.5 w-px bg-border max-sm:hidden" />
	);
}

/** Bottom line: draft sync state and this month's proxy requests (with a gauge). */
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
	const share =
		proxy && proxy.max !== null && proxy.max > 0
			? Math.min(1, proxy.used / proxy.max)
			: null;

	return (
		<div
			data-id="statusbar"
			className="flex min-h-8 flex-none flex-wrap items-center gap-x-3 gap-y-1 border-border-subtle border-t bg-surface px-3 py-1 font-mono text-muted text-xs"
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
				<>
					<Separator />
					<span
						data-id="statusbar-proxy-quota"
						className="flex items-center gap-2"
					>
						{proxy.max === null
							? t("apiClient.status.proxyUnlimited")
							: t("apiClient.status.proxyUsed", {
									used: formatNumber(Math.min(proxy.used, proxy.max)),
									max: formatNumber(proxy.max),
								})}
						{share === null ? null : (
							<span
								aria-hidden="true"
								className="block h-1.5 w-12 overflow-hidden rounded-full bg-bar-track"
							>
								<span
									className={cn(
										"block h-full rounded-full",
										share >= WARNING_RATIO ? "bg-warning" : "bg-primary",
									)}
									style={{ width: `${Math.round(share * 100)}%` }}
								/>
							</span>
						)}
					</span>
				</>
			) : null}
			<span className="ml-auto max-md:hidden">
				{t("apiClient.status.shortcuts")}
			</span>
		</div>
	);
}
