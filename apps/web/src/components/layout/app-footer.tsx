import { brand } from "@localman/shared/brand";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { feedbackSourceFor } from "../../features/feedback/feedback-draft";
import { FeedbackForm } from "../../features/feedback/feedback-form";
import { useT } from "../../i18n/i18n-context";
import { LanguagePill } from "../../i18n/language-pill";
import { cn } from "../../lib/cn";
import { ThemeToggle } from "../theme/theme-toggle";
import { LegalLinks } from "./legal-links";
import { TAP_TARGET } from "./public-account-slot";

/** `.foot-link` of the account app: a quiet 13px link, underlined on hover. */
const FOOT_LINK = cn(
	"cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[0.8125rem] text-muted no-underline underline-offset-2 hover:text-fg hover:underline",
	TAP_TARGET,
);

/**
 * Page footer, laid out like the account app's (auth-next `.page-foot`):
 * the language pill and the theme switch, then one quiet row: "An app from
 * <domain>" (the brand's home), the legal pages, Docs and the
 * "Feedback / Contact" form (in place of a contact email).
 */
export function AppFooter() {
	const t = useT();
	const { pathname } = useLocation();
	const [open, setOpen] = useState(false);
	const domain = brand.primaryTenant.domain;
	return (
		<footer
			data-id="app-footer"
			className="mx-auto flex w-full max-w-page flex-col items-center gap-3 px-gutter pt-6 pb-[calc(var(--space-7)+env(safe-area-inset-bottom))]"
		>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<LanguagePill data-id="app-footer-language" />
				<ThemeToggle data-id="app-footer-theme" />
			</div>
			<div className="flex flex-wrap items-center justify-center gap-x-4">
				<a
					href={`https://${domain}`}
					data-id="app-footer-home"
					className={FOOT_LINK}
				>
					{t("layout.footer.ecosystem", { domain })}
				</a>
				<LegalLinks
					data-id="app-footer-legal"
					linkClassName={FOOT_LINK}
					className="gap-x-4 gap-y-0"
				/>
				<Link to="/docs" data-id="app-footer-docs" className={FOOT_LINK}>
					{t("layout.docs")}
				</Link>
				<button
					type="button"
					data-id="app-footer-feedback"
					onClick={() => setOpen(true)}
					className={FOOT_LINK}
				>
					{t("layout.footer.feedback")}
				</button>
			</div>
			<FeedbackForm
				open={open}
				onOpenChange={setOpen}
				source={feedbackSourceFor(pathname)}
			/>
		</footer>
	);
}
