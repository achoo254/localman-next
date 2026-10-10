import { type PlanId, limitsFor } from "@localman/shared/constants";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { PlanCard } from "../../features/subscription/plan-card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface PricingTableProps {
	/** "Contact" on the Pro card: opens the Pro interest form. */
	onContactPro: () => void;
	/**
	 * Plan of the signed-in user, or null for a visitor (and while the
	 * session is unknown). A signed-in user sees "Current plan" on their
	 * card and "Open app" instead of a sign-up invitation.
	 */
	plan: PlanId | null;
}

const FREE_ACTION_CLASS = cn(
	buttonClassName({ variant: "secondary", block: true }),
	"no-underline",
);

/**
 * Free and Pro cards rendered from `limitsFor`. Pro has no price and no
 * "not decided yet": its only action is "Contact", so interest can be
 * counted; a Pro user has nothing to ask for there.
 */
export function PricingTable({ onContactPro, plan }: PricingTableProps) {
	const t = useT();
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
						<Badge tone="primary">{t("landing.pricing.proBadge")}</Badge>
					)
				}
				lead={t("landing.pricing.proLead")}
				action={
					plan === "pro" ? null : (
						<Button
							variant="primary"
							block
							data-id="pricing-card-pro-cta"
							onClick={onContactPro}
						>
							{t("common.cta.contact")}
						</Button>
					)
				}
			/>
		</div>
	);
}
