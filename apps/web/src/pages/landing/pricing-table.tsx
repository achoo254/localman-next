import { TRIAL_DAYS, limitsFor } from "@localman/shared/constants";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { PlanCard } from "../../features/subscription/plan-card";
import { ProTrialAction } from "../../features/subscription/pro-trial-action";
import type { TrialViewer } from "../../features/subscription/trial-state";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface PricingTableProps {
	/** Secondary link of the Pro card: opens the Pro interest form. */
	onContactPro: () => void;
	/** Main button of the Pro card for a Free user: opens the confirmation. */
	onStartTrial: () => void;
	/**
	 * The signed-in user, or null for a visitor (and while the session is
	 * unknown). A signed-in user sees "Current plan" on their card, "Open
	 * app" instead of a sign-up invitation and the Pro trial by its state.
	 */
	user: TrialViewer | null;
}

const FREE_ACTION_CLASS = cn(
	buttonClassName({ variant: "secondary", block: true }),
	"no-underline",
);

/**
 * Free and Pro cards rendered from `limitsFor`. Pro has no price: it is a
 * free trial for now, with the interest form as a secondary link.
 */
export function PricingTable({
	onContactPro,
	onStartTrial,
	user,
}: PricingTableProps) {
	const t = useT();
	const plan = user?.plan ?? null;
	const current = (
		<Badge data-id="pricing-card-current">
			{t("subscription.manage.currentBadge")}
		</Badge>
	);
	return (
		<div className="grid max-w-220 gap-4 md:grid-cols-2">
			<PlanCard
				data-id="pricing-card-free"
				name="Free"
				size="md"
				limits={limitsFor("free")}
				badge={plan === "free" ? current : null}
				price={t("landing.pricing.freePrice")}
				action={
					plan === null ? (
						<LoginLink
							returnTo="/projects"
							prompt="create"
							data-id="pricing-card-free-cta"
							className={FREE_ACTION_CLASS}
						>
							{t("common.cta.startFree")}
						</LoginLink>
					) : (
						<Link
							to="/projects"
							data-id="pricing-card-free-cta"
							className={FREE_ACTION_CLASS}
						>
							{t("common.cta.openApp")}
						</Link>
					)
				}
			/>
			<PlanCard
				data-id="pricing-card-pro"
				name="Pro"
				size="md"
				featured
				limits={limitsFor("pro")}
				badge={
					plan === "pro" ? (
						current
					) : (
						<Badge tone="primary" data-id="pricing-card-pro-trial">
							{t("trial.badge", { days: TRIAL_DAYS })}
						</Badge>
					)
				}
				lead={t("subscription.manage.proLead")}
				action={
					<ProTrialAction
						data-id="pricing-card-pro"
						user={user}
						onStart={onStartTrial}
						onTellUs={onContactPro}
					/>
				}
			/>
		</div>
	);
}
