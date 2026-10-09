import { limitsFor } from "@localman/shared/constants";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { PlanCard } from "../../features/subscription/plan-card";
import { ProInterestModal } from "../../features/subscription/pro-interest-modal";
import { cn } from "../../lib/cn";

/** Free and Pro cards; Pro has no price yet and opens the interest form. */
export function LandingPricing() {
	const [interestOpen, setInterestOpen] = useState(false);
	return (
		<section
			data-id="pricing"
			aria-labelledby="pricing-title"
			className="mx-auto grid w-full max-w-220 gap-6"
		>
			<h2 id="pricing-title" className="m-0 text-center font-bold text-2xl">
				Gói dịch vụ
			</h2>
			<div className="grid gap-4 md:grid-cols-2">
				<PlanCard
					data-id="pricing-card-free"
					name="Free"
					limits={limitsFor("free")}
					lead="Miễn phí"
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
							Tạo tài khoản miễn phí
						</LoginLink>
					}
				/>
				<PlanCard
					data-id="pricing-card-pro"
					name="Pro"
					featured
					limits={limitsFor("pro")}
					badge={<Badge tone="primary">Đang nhận đăng ký</Badge>}
					lead="Hạn mức lớn hơn cho team và dự án thật. Để lại nhu cầu, chúng tôi liên hệ khi gói Pro mở."
					action={
						<Button
							variant="primary"
							block
							data-id="pricing-card-pro-cta"
							onClick={() => setInterestOpen(true)}
						>
							Liên hệ
						</Button>
					}
				/>
			</div>
			<ProInterestModal
				open={interestOpen}
				onOpenChange={setInterestOpen}
				source="landing"
			/>
		</section>
	);
}
