import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";
import { PricingSection } from "../landing/pricing-section";

/**
 * `/pricing`: the landing's pricing block as a page of its own, for
 * visitors and signed-in users alike (their plan is marked as current).
 * Prerendered like the landing; its static title and description come from
 * `prerender-pages.ts`.
 */
export function PricingPage() {
	const t = useT();
	useAppTitle(t("layout.pricing"));
	return <PricingSection headingLevel={1} />;
}
