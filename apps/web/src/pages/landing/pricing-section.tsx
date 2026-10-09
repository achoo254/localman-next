import { useState } from "react";
import { ProInterestModal } from "../../features/subscription/pro-interest-modal";
import { LandingSection } from "./landing-section";
import { PricingTable } from "./pricing-table";

/** "Bảng giá": the two plan cards, the note and the Pro interest form. */
export function PricingSection() {
	const [interestOpen, setInterestOpen] = useState(false);
	return (
		<LandingSection
			id="pricing"
			data-id="landing-pricing"
			eyebrow="Bảng giá"
			title="Bắt đầu miễn phí, nâng cấp khi cần"
		>
			<div className="grid gap-4">
				<PricingTable onContactPro={() => setInterestOpen(true)} />
				<p
					data-id="landing-pricing-note"
					className="m-0 max-w-220 text-[0.8125rem] text-muted"
				>
					Gói Pro chưa mở thanh toán. Bấm Liên hệ để cho chúng tôi biết bạn cần
					gì. Mức không giới hạn theo tháng vẫn có giới hạn tốc độ theo giây để
					chống lạm dụng.
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
