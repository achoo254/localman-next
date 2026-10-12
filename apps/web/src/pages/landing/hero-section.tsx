import { limitsFor } from "@localman/shared/constants";
import { Badge } from "../../components/ui/badge";
import { buttonClassName } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { AuthErrorAlert } from "./auth-error-alert";
import { HeroPreview } from "./hero-preview";
import { StartCta } from "./start-cta";

const CODE_WORD = "font-mono text-primary";

const codeWord = (chunk: string) => <span className={CODE_WORD}>{chunk}</span>;

/**
 * Hero with two messages: the mock pitch until the API client is in
 * production, then "Localhost right in your browser".
 */
export function HeroSection({ howItWorksHref }: { howItWorksHref: string }) {
	const { apiClient } = useFeatures();
	const t = useT();
	const free = limitsFor("free");
	const proxy = free.proxyRequestsPerMonth;
	const limits = { projects: free.projects, resources: free.resources };
	return (
		<section
			data-id="landing-hero"
			aria-labelledby="landing-hero-title"
			className="grid items-center gap-8 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-24"
		>
			<div data-id="landing-hero-copy" className="grid min-w-0 gap-6">
				<AuthErrorAlert />
				<Badge tone="primary" className="justify-self-start">
					{t(
						apiClient
							? "landing.hero.badgeLocalhost"
							: "landing.hero.badgeMock",
					)}
				</Badge>
				<h1
					id="landing-hero-title"
					className="m-0 font-bold text-[clamp(1.875rem,4.4vw,2.875rem)] leading-tight tracking-[-0.02em]"
				>
					{renderRich(
						apiClient
							? t("landing.hero.titleLocalhost")
							: t("landing.hero.titleMock"),
						{ code: codeWord },
					)}
				</h1>
				<p data-id="landing-hero-sub" className="m-0 text-lg text-muted">
					{apiClient
						? renderRich(t("landing.hero.subLocalhost"), {
								b: (chunk) => <b className="text-fg">{chunk}</b>,
							})
						: t("landing.hero.subMock")}
				</p>
				<div className="flex flex-wrap gap-3">
					<StartCta data-id="landing-hero-cta" />
					<a
						href={howItWorksHref}
						data-id="landing-hero-how"
						className={cn(
							buttonClassName({ variant: "secondary", size: "lg" }),
							"no-underline max-sm:w-full",
						)}
					>
						{t("landing.hero.howItWorks")}
					</a>
				</div>
				<p className="m-0 text-[0.8125rem] text-muted">
					{apiClient && proxy !== null
						? t("landing.hero.noteLocalhost", { ...limits, proxy })
						: t("landing.hero.noteMock", limits)}
				</p>
			</div>
			<HeroPreview localhost={apiClient} />
		</section>
	);
}
