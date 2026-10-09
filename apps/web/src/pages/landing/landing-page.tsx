import { Suspense, lazy } from "react";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { cn } from "../../lib/cn";
import { useDocumentTitle } from "../../lib/use-document-title";
import { ComparisonSection } from "./comparison-section";
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
 * Tab titles of the landing, one per hero message. `index.html` carries the
 * same text statically for crawlers (checked by the landing test).
 */
export const LANDING_TITLES = {
	mock: "Localman · Mock REST API có trạng thái, quan hệ và Faker",
	localhost: "Localman · Test API localhost ngay trên trình duyệt",
} as const;

/**
 * Public landing, in the order of the phase: hero, flagged feature blocks,
 * comparison, pricing, schema, relations, "Và nhiều hơn" and the closing
 * call to action. The footer comes from `AppLayout`.
 */
export function LandingPage() {
	const flags = useFeatures();
	useDocumentTitle(
		flags.apiClient ? LANDING_TITLES.localhost : LANDING_TITLES.mock,
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
			<ComparisonSection />
			<PricingSection />
			<DataModelingDemo />
			<RelationsDemo />
			<MoreFeaturesSection />
			<CtaBand />
		</>
	);
}

function CtaBand() {
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
					Dựng mock API đầu tiên trong vài phút
				</h2>
				<p className="m-0 text-muted">
					Tạo tài khoản, thêm resource, bấm thanh sinh dữ liệu là có endpoint
					chạy được.
				</p>
			</div>
			<SignUpCta data-id="landing-cta-button" />
		</section>
	);
}
