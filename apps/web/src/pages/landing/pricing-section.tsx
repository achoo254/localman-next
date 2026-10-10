import { useState } from "react";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { ProInterestModal } from "../../features/subscription/pro-interest-modal";
import { useT } from "../../i18n/i18n-context";
import { LandingSection } from "./landing-section";
import { PricingTable } from "./pricing-table";

export interface PricingSectionProps {
	/** 1 on the `/pricing` page, where the block is the page; 2 on the landing. */
	headingLevel?: 1 | 2;
}

/**
 * "Pricing": the two plan cards, the note and the Pro interest form, on the
 * landing and on `/pricing`. A signed-in user's plan is marked as current.
 */
export function PricingSection({ headingLevel = 2 }: PricingSectionProps) {
	const [interestOpen, setInterestOpen] = useState(false);
	const session = useCurrentUser();
	const t = useT();
	return (
		<LandingSection
			id="pricing"
			data-id="landing-pricing"
			eyebrow={t("landing.pricing.eyebrow")}
			title={t("landing.pricing.title")}
			headingLevel={headingLevel}
		>
			<div className="grid gap-4">
				<PricingTable
					onContactPro={() => setInterestOpen(true)}
					plan={session.status === "authenticated" ? session.user.plan : null}
				/>
				<p
					data-id="landing-pricing-note"
					className="m-0 max-w-220 text-[0.8125rem] text-muted"
				>
					{t("landing.pricing.note")}
				</p>
			</div>
			<ProInterestModal
				open={interestOpen}
				onOpenChange={setInterestOpen}
				source="landing"
			/>
		</LandingSection>
	);
}
