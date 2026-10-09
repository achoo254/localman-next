import { IconArrowRight } from "@tabler/icons-react";
import { Wordmark } from "../../components/brand/wordmark";
import { buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { cn } from "../../lib/cn";
import { AuthErrorAlert } from "./auth-error-alert";

/** Minimal public landing: sign in, or create an account at the IdP. */
export function LandingPage() {
	return (
		<section
			data-id="landing-hero"
			className="mx-auto grid max-w-160 justify-items-center gap-6 py-16 text-center"
		>
			<h1 className="m-0 font-bold text-4xl tracking-[-0.02em]">
				<Wordmark className="text-4xl" />
			</h1>
			<AuthErrorAlert />
			<p className="m-0 text-lg text-muted">
				Dựng mock API trong vài phút, dùng chung một tài khoản hoandat với
				Tunelo.
			</p>
			<div className="flex flex-wrap justify-center gap-3">
				<LoginLink
					returnTo="/projects"
					data-id="landing-hero-login"
					className={cn(
						buttonClassName({ variant: "secondary" }),
						"no-underline",
					)}
				>
					Đăng nhập
				</LoginLink>
				<LoginLink
					returnTo="/projects"
					prompt="create"
					data-id="landing-hero-cta"
					className={cn(
						buttonClassName({ variant: "primary" }),
						"no-underline",
					)}
				>
					Bắt đầu miễn phí
					<IconArrowRight size={20} aria-hidden="true" />
				</LoginLink>
			</div>
		</section>
	);
}
