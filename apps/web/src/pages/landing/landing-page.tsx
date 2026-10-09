import { Suspense, lazy } from "react";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useDocumentTitle } from "../../lib/use-document-title";
import { DataModelingDemo } from "./data-modeling-demo";
import { HeroSection, SignUpCta } from "./hero-section";
import { MoreFeaturesSection } from "./more-features-section";
import { PricingSection } from "./pricing-section";
import { RelationsDemo } from "./relations-demo";

// Flagged blocks load on demand, so an unreleased feature adds nothing to
// the landing bundle until its flag is on.
const LiveMockSyncSection = lazy(async () => ({
	default: (await import("./live-mock-sync-section")).LiveMockSyncSection,
}));
const MockMcpSection = lazy(async () => ({
	default: (await import("./mock-mcp-section")).MockMcpSection,
}));

/**
 * Public landing: hero, flagged feature blocks, pricing, schema,
 * relations, "And more" and the closing call to action. The footer comes
 * from `AppLayout`. The tab title follows the hero message; `index.html`
 * carries the English one statically for crawlers (checked by a test).
 */
export function LandingPage() {
	const flags = useFeatures();
	const t = useT();
	useDocumentTitle(
		t(
			flags.apiClient
				? "landing.meta.titleLocalhost"
				: "landing.meta.titleMock",
		),
	);
	return (
		<>
			<HeroSection
				howItWorksHref={flags.liveMockSync ? "#live-sync" : "#relations"}
			/>
			{flags.liveMockSync ? (
				<Suspense fallback={null}>
					<LiveMockSyncSection />
				</Suspense>
			) : null}
			{flags.mockMcp ? (
				<Suspense fallback={null}>
					<MockMcpSection />
				</Suspense>
			) : null}
			<PricingSection />
			<DataModelingDemo />
			<RelationsDemo />
			<MoreFeaturesSection />
			<CtaBand />
		</>
	);
}

function CtaBand() {
	const t = useT();
	return (
		<section
			data-id="landing-cta"
			aria-labelledby="landing-cta-title"
			className={cn(
				cardClassName,
				"my-16 flex flex-wrap items-center justify-between gap-6 p-8",
			)}
		>
			<div className="grid gap-2">
				<h2
					id="landing-cta-title"
					className="m-0 font-bold text-[clamp(1.375rem,3vw,1.75rem)] tracking-[-0.02em]"
				>
					{t("landing.cta.title")}
				</h2>
				<p className="m-0 text-muted">{t("landing.cta.text")}</p>
			</div>
			<SignUpCta data-id="landing-cta-button" />
		</section>
	);
}
