import { limitsFor } from "@localman/shared/constants";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { PlanCard } from "../../features/subscription/plan-card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface PricingTableProps {
	/** "Contact" on the Pro card: opens the Pro interest form. */
	onContactPro: () => void;
}

/**
 * Free and Pro cards rendered from `limitsFor`. Pro has no price and no
 * "not decided yet": its only action is "Contact", so interest can be
 * counted.
 */
export function PricingTable({ onContactPro }: PricingTableProps) {
	const t = useT();
	return (
		<div className="grid max-w-220 gap-4 md:grid-cols-2">
			<PlanCard
				data-id="pricing-card-free"
				name="Free"
				size="md"
				limits={limitsFor("free")}
				price={t("landing.pricing.freePrice")}
				action={
					<LoginLink
						returnTo="/projects"
						prompt="create"
						data-id="pricing-card-free-cta"
						className={cn(
							buttonClassName({ variant: "secondary", block: true }),
							"no-underline",
						)}
					>
						{t("common.cta.startFree")}
					</LoginLink>
				}
			/>
			<PlanCard
				data-id="pricing-card-pro"
				name="Pro"
				size="md"
				featured
				limits={limitsFor("pro")}
				badge={<Badge tone="primary">{t("landing.pricing.proBadge")}</Badge>}
				lead={t("landing.pricing.proLead")}
				action={
					<Button
						variant="primary"
						block
						data-id="pricing-card-pro-cta"
						onClick={onContactPro}
					>
						{t("common.cta.contact")}
					</Button>
				}
			/>
		</div>
	);
}
