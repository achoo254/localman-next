import { useFeatures } from "../../config/features";
import type { AccountUsage } from "../../features/subscription/account-usage-api";
import { UsageMeter } from "../../features/subscription/usage-meter";
import { useI18n } from "../../i18n/i18n-context";

/**
 * Noon (Asia/Saigon) of the first day after a `YYYY-MM` period, when the
 * quotas reset; null for a malformed period. Noon keeps the day the same
 * in any timezone the date is shown in.
 */
function nextPeriodStartIso(period: string): string | null {
	const match = /^(\d{4})-(\d{2})$/.exec(period);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const next =
		month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
	return `${next.year}-${String(next.month).padStart(2, "0")}-01T12:00:00+07:00`;
}

/**
 * Quota meters. The proxy meter and the "MCP counts too" note wait for the
 * API client and Mock MCP to reach production.
 */
export function AccountMeters({ usage }: { usage: AccountUsage }) {
	const flags = useFeatures();
	const { t, formatDate } = useI18n();
	const resetAt = nextPeriodStartIso(usage.period);
	const date = resetAt ? formatDate(resetAt) : "";
	const mockNote = flags.mockMcp
		? t("account.meters.mockNoteMcp", { date })
		: t("account.meters.mockNote", { date });
	return (
		<div data-id="account-meters" className="grid gap-4 md:grid-cols-2">
			<UsageMeter
				data-id="account-meter-projects"
				label={t("account.meters.projects")}
				counter={usage.projects}
				note={t("account.meters.projectsNote")}
			/>
			<UsageMeter
				data-id="account-meter-mock-requests"
				label={t("account.meters.mockRequests")}
				counter={usage.mockRequests}
				note={mockNote}
			/>
			{flags.apiClient ? (
				<UsageMeter
					data-id="account-meter-proxy-requests"
					label={t("account.meters.proxyRequests")}
					counter={usage.proxyRequests}
					note={t("account.meters.proxyNote", { date })}
				/>
			) : null}
		</div>
	);
}
