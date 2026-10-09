import { limitsFor } from "@localman/shared/constants";
import { IconArrowRight } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { buttonClassName } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { LoginLink } from "../../features/auth/login-link";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";
import { AuthErrorAlert } from "./auth-error-alert";
import { HeroPreview } from "./hero-preview";

const CODE_WORD = "font-mono text-primary";

/** Sign-up link styled as a large primary button (hero and closing band). */
export function SignUpCta({ "data-id": dataId }: { "data-id": string }) {
	return (
		<LoginLink
			returnTo="/projects"
			prompt="create"
			data-id={dataId}
			className={cn(
				buttonClassName({ variant: "primary", size: "lg" }),
				"no-underline max-sm:w-full",
			)}
		>
			Bắt đầu miễn phí
			<IconArrowRight size={20} aria-hidden="true" />
		</LoginLink>
	);
}

/**
 * Hero with two messages: the mock pitch until the API client is in
 * production, then "Localhost ngay trên trình duyệt".
 */
export function HeroSection({ howItWorksHref }: { howItWorksHref: string }) {
	const { apiClient } = useFeatures();
	const free = limitsFor("free");
	const proxy = free.proxyRequestsPerMonth;
	return (
		<section
			data-id="landing-hero"
			aria-labelledby="landing-hero-title"
			className="grid items-center gap-8 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-24"
		>
			<div data-id="landing-hero-copy" className="grid min-w-0 gap-6">
				<AuthErrorAlert />
				<Badge tone="primary" className="justify-self-start">
					{apiClient
						? "Localhost ngay trên trình duyệt"
						: "Mock REST API cho developer"}
				</Badge>
				<h1
					id="landing-hero-title"
					className="m-0 font-bold text-[clamp(1.875rem,4.4vw,2.875rem)] leading-tight tracking-[-0.02em]"
				>
					{apiClient ? (
						<>
							Test API <span className={CODE_WORD}>localhost</span> ngay trên
							trình duyệt
						</>
					) : (
						<>
							<span className={CODE_WORD}>Mock</span> REST API có trạng thái,
							quan hệ và Faker, gói Free {free.projects} project
						</>
					)}
				</h1>
				<p data-id="landing-hero-sub" className="m-0 text-lg text-muted">
					{apiClient ? (
						<>
							<b className="text-fg">
								Không cần cài app hay extension, chỉ một lệnh Tunelo.
							</b>{" "}
							Chạy <code>tunelo http 3000</code>, Localman tự nhận tunnel theo
							port và gửi request tới <code>localhost</code> hay máy trong mạng
							LAN. Kèm mock REST API có trạng thái để frontend không phải chờ
							backend.
						</>
					) : (
						"Khai báo resource, sinh dữ liệu giả bằng một click và có ngay endpoint CRUD đầy đủ. Frontend không phải chờ backend nữa."
					)}
				</p>
				<div className="flex flex-wrap gap-3">
					<SignUpCta data-id="landing-hero-cta" />
					<a
						href={howItWorksHref}
						data-id="landing-hero-how"
						className={cn(
							buttonClassName({ variant: "secondary", size: "lg" }),
							"no-underline max-sm:w-full",
						)}
					>
						Xem cách hoạt động
					</a>
				</div>
				<p className="m-0 text-[0.8125rem] text-muted">
					Không cần thẻ thanh toán. Gói Free gồm{" "}
					{apiClient && proxy !== null
						? `${free.projects} project mock, ${free.resources} resource mỗi project, ${formatNumber(proxy)} request qua proxy mỗi tháng.`
						: `${free.projects} project, ${free.resources} resource mỗi project, custom response miễn phí.`}
				</p>
			</div>
			<HeroPreview localhost={apiClient} />
		</section>
	);
}
