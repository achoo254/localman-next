import { limitsFor } from "@localman/shared/constants";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { PlanCard } from "../../features/subscription/plan-card";
import { cn } from "../../lib/cn";

export interface PricingTableProps {
	/** "Liên hệ" on the Pro card: opens the Pro interest form. */
	onContactPro: () => void;
}

/**
 * Free and Pro cards rendered from `limitsFor`. Pro has no price and no
 * "chưa chốt": its only action is "Liên hệ", so interest can be counted.
 */
export function PricingTable({ onContactPro }: PricingTableProps) {
	return (
		<div className="grid max-w-220 gap-4 md:grid-cols-2">
			<PlanCard
				data-id="pricing-card-free"
				name="Free"
				size="md"
				limits={limitsFor("free")}
				price="Miễn phí"
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
						Bắt đầu miễn phí
					</LoginLink>
				}
			/>
			<PlanCard
				data-id="pricing-card-pro"
				name="Pro"
				size="md"
				featured
				limits={limitsFor("pro")}
				badge={<Badge tone="primary">Nhận đăng ký quan tâm</Badge>}
				lead="Hạn mức lớn hơn cho các project chạy thật, nhiều thành viên hơn. Để lại nhu cầu, chúng tôi liên hệ khi gói Pro mở."
				action={
					<Button
						variant="primary"
						block
						data-id="pricing-card-pro-cta"
						onClick={onContactPro}
					>
						Liên hệ
					</Button>
				}
			/>
		</div>
	);
}
