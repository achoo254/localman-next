import { limitsFor } from "@localman/shared/constants";
import { IconBell } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import {
	type AccountUsage,
	fetchAccountUsage,
} from "../../features/subscription/account-usage-api";
import { UsageMeter } from "../../features/subscription/usage-meter";
import { UsageMetersSkeleton } from "../../features/subscription/usage-meters-skeleton";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { useI18n } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";

type UsageState =
	| { status: "loading" }
	| { status: "ready"; usage: AccountUsage }
	| { status: "error"; error: unknown };

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;

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

/** `/account`: current plan and this month's quota meters. */
export function AccountPage() {
	const { t, formatDate } = useI18n();
	useAppTitle(t("account.title"));
	const session = useCurrentUser();
	const flags = useFeatures();
	const user = session.status === "authenticated" ? session.user : null;
	const [state, setState] = useState<UsageState>({ status: "loading" });
	// Held its minimum time even when the usage comes back sooner.
	const skeleton = useDelayedFlag(state.status === "loading");
	const plan =
		state.status === "ready" ? state.usage.plan : (user?.plan ?? "free");
	const subscription = useSubscriptionDialogs(plan, "account");
	const limits = limitsFor(plan);

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			setState({ status: "ready", usage: await fetchAccountUsage() });
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const expiresAt = state.status === "ready" ? state.usage.planExpiresAt : null;
	const planName = expiresAt
		? t("account.plan.nameExpires", {
				plan: PLAN_NAME[plan],
				date: formatDate(expiresAt),
			})
		: t("account.plan.name", { plan: PLAN_NAME[plan] });
	const limitsText = t("account.plan.limits", {
		projects: t("account.plan.projects", { count: limits.projects }),
		resources: t("account.plan.resources", { count: limits.resources }),
		members: t("account.plan.members", { count: limits.membersPerWorkspace }),
	});

	return (
		<section data-id="account" className="grid gap-5">
			<h1 className="m-0 flex min-h-11 items-center font-bold font-mono text-xl">
				{t("account.title")}
			</h1>
			<section
				data-id="account-plan"
				className={cn(
					cardClassName,
					"flex flex-wrap items-center justify-between gap-3 p-6",
				)}
			>
				<div className="grid gap-1">
					<h2 className="m-0 font-bold font-mono text-base">{planName}</h2>
					<p className="m-0 text-muted text-sm">
						{user?.email ? `${user.email} · ` : ""}
						{limitsText}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						to={NOTIFICATION_SETTINGS_PATH}
						data-id="account-notify-settings"
						className={cn(buttonClassName(), "no-underline")}
					>
						<IconBell size={16} aria-hidden="true" />
						{t("account.plan.notificationChannels")}
					</Link>
					<Button
						variant="primary"
						data-id="account-plan-manage"
						onClick={() => subscription.openPlans()}
					>
						{t("account.plan.manage")}
					</Button>
				</div>
			</section>
			{skeleton ? (
				<UsageMetersSkeleton
					data-id="account-meters-loading"
					label={t("account.usage.loading")}
					count={flags.apiClient ? 3 : 2}
					className="grid gap-4 md:grid-cols-2"
				/>
			) : null}
			{state.status === "error" && !skeleton ? (
				<div
					data-id="account-meters-error"
					className="grid justify-items-start gap-3"
				>
					<Alert tone="danger" title={t("account.usage.loadFailed")}>
						{errorMessage(state.error)}
					</Alert>
					<Button onClick={() => void load()}>{t("common.cta.retry")}</Button>
				</div>
			) : null}
			{state.status === "ready" && !skeleton ? (
				<AccountMeters usage={state.usage} />
			) : null}
			{subscription.element}
		</section>
	);
}

/**
 * Quota meters. The proxy meter and the "MCP counts too" note wait for the
 * API client and Mock MCP to reach production.
 */
function AccountMeters({ usage }: { usage: AccountUsage }) {
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
