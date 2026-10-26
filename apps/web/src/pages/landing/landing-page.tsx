import { Suspense, lazy } from "react";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { useDocumentTitle } from "../../lib/use-document-title";
import { CtaBand, MidCta } from "./cta-band";
import { DataModelingDemo } from "./data-modeling-demo";
import { HeroSection } from "./hero-section";
import { MoreFeaturesSection } from "./more-features-section";
import { RelationsDemo } from "./relations-demo";

// Flagged blocks load on demand, so an unreleased feature adds nothing to
// the landing bundle until its flag is on.
const LiveMockSyncSection = lazy(async () => ({
	default: (await import("./live-mock-sync-section")).LiveMockSyncSection,
}));
const MockMcpSection = lazy(async () => ({
	default: (await import("./mock-mcp-section")).MockMcpSection,
}));
const SecretsStaySection = lazy(async () => ({
	default: (await import("./secrets-stay-section")).SecretsStaySection,
}));
const VnFakeDataTeaser = lazy(async () => ({
	default: (await import("./vn-fake-data-teaser")).VnFakeDataTeaser,
}));

/**
 * Public landing: hero, flagged feature blocks (Live Mock Sync, Mock MCP,
 * secrets staying in the browser), schema,
 * relations, a call to action right after the demos, "And more", the fake data tool link (flagged) and the
 * closing call to action. The footer comes
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
			{flags.secretVault ? (
				<Suspense fallback={null}>
					<SecretsStaySection />
				</Suspense>
			) : null}
			<DataModelingDemo />
			<RelationsDemo />
			<MidCta />
			<MoreFeaturesSection />
			{flags.vnFakeData ? (
				<Suspense fallback={null}>
					<VnFakeDataTeaser />
				</Suspense>
			) : null}
			<CtaBand />
		</>
	);
}
