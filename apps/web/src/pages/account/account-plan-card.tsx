import { type PlanId, TRIAL_DAYS, limitsFor } from "@localman/shared/constants";
import { IconBell } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import type { CurrentUser } from "../../features/auth/current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import {
	trialDaysLeft,
	trialView,
} from "../../features/subscription/trial-state";
import { useI18n } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;
/** The countdown turns to a warning in the trial's last week. */
const WARN_DAYS = 7;

export interface AccountPlanCardProps {
	plan: PlanId;
	/** `planExpiresAt` of the usage, once loaded. */
	expiresAt: string | null;
	user: CurrentUser | null;
	onManage: () => void;
	onStartTrial: () => void;
}

/**
 * Plan summary: name (with the trial's end and countdown while it runs),
 * limits, and the plan actions.
 */
export function AccountPlanCard({
	plan,
	expiresAt,
	user,
	onManage,
	onStartTrial,
}: AccountPlanCardProps) {
	const { t, formatDate } = useI18n();
	const limits = limitsFor(plan);
	const view = user ? trialView(user) : null;
	const trialEndsAt = view === "active" ? (user?.trial.endsAt ?? null) : null;
	const daysLeft = trialDaysLeft(trialEndsAt);

	let planName: string;
	if (trialEndsAt) {
		planName = t("trial.planName", { date: formatDate(trialEndsAt) });
	} else if (expiresAt) {
		planName = t("account.plan.nameExpires", {
			plan: PLAN_NAME[plan],
			date: formatDate(expiresAt),
		});
	} else {
		planName = t("account.plan.name", { plan: PLAN_NAME[plan] });
	}
	const limitsText = t("account.plan.limits", {
		projects: t("account.plan.projects", { count: limits.projects }),
		resources: t("account.plan.resources", { count: limits.resources }),
		members: t("account.plan.members", { count: limits.membersPerWorkspace }),
	});

	return (
		<section
			data-id="account-plan"
			className={cn(
				cardClassName,
				"flex flex-wrap items-center justify-between gap-3 p-6",
			)}
		>
			<div className="grid gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="m-0 font-bold font-mono text-base">{planName}</h2>
					{daysLeft !== null ? (
						<Badge
							tone={daysLeft <= WARN_DAYS ? "warning" : "primary"}
							data-id="account-plan-trial-countdown"
						>
							{daysLeft === 0
								? t("trial.lastDay")
								: t("trial.daysLeft", { count: daysLeft })}
						</Badge>
					) : null}
				</div>
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
				{view === "available" ? (
					<Button
						variant="primary"
						data-id="account-plan-start-trial"
						onClick={onStartTrial}
					>
						{t("trial.start", { days: TRIAL_DAYS })}
					</Button>
				) : null}
				<Button
					variant={view === "available" ? "secondary" : "primary"}
					data-id="account-plan-manage"
					onClick={onManage}
				>
					{t("account.plan.manage")}
				</Button>
			</div>
		</section>
	);
}
