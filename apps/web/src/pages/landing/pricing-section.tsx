import { useState } from "react";
import { ProInterestModal } from "../../features/subscription/pro-interest-modal";
import { useT } from "../../i18n/i18n-context";
import { LandingSection } from "./landing-section";
import { PricingTable } from "./pricing-table";

/** "Pricing": the two plan cards, the note and the Pro interest form. */
export function PricingSection() {
	const [interestOpen, setInterestOpen] = useState(false);
	const t = useT();
	return (
		<LandingSection
			id="pricing"
			data-id="landing-pricing"
			eyebrow={t("landing.pricing.eyebrow")}
			title={t("landing.pricing.title")}
		>
			<div className="grid gap-4">
				<PricingTable onContactPro={() => setInterestOpen(true)} />
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
