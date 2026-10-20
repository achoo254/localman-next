import { useState } from "react";
import { Link, useLocation } from "react-router";
import { feedbackSourceFor } from "../../features/feedback/feedback-draft";
import { FeedbackForm } from "../../features/feedback/feedback-form";
import { useT } from "../../i18n/i18n-context";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { ThemeToggle } from "../theme/theme-toggle";
import { LegalLinks } from "./legal-links";

const FOOTER_LINK =
	"inline-flex min-h-11 cursor-pointer items-center rounded-sm font-mono font-semibold text-primary underline-offset-4 hover:underline";

/**
 * Page footer: the landing ("Localman home"), Docs, the
 * "Feedback / Contact" form (in place of a contact email), the legal pages
 * and the language switcher.
 */
export function AppFooter() {
	const t = useT();
	const { pathname } = useLocation();
	const [open, setOpen] = useState(false);
	return (
		<footer
			data-id="app-footer"
			className="border-border-subtle border-t py-6 text-[0.8125rem] text-muted"
		>
			<div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-3 px-gutter">
				{/* The prerendered landing carries its build year; a new year only
				    differs until the next deploy, so the mismatch is expected. */}
				<span suppressHydrationWarning>
					{t("layout.footer.copyright", {
						year: String(new Date().getFullYear()),
					})}
				</span>
				<div className="flex flex-wrap items-center gap-4">
					<Link to="/" data-id="app-footer-home" className={FOOTER_LINK}>
						{t("layout.home")}
					</Link>
					<Link to="/docs" data-id="app-footer-docs" className={FOOTER_LINK}>
						{t("layout.docs")}
					</Link>
					<button
						type="button"
						data-id="app-footer-feedback"
						onClick={() => setOpen(true)}
						className={FOOTER_LINK}
					>
						{t("layout.footer.feedback")}
					</button>
					<LegalLinks data-id="app-footer-legal" linkClassName={FOOTER_LINK} />
					<LanguageSwitcher data-id="app-footer-language" />
					{/* The top bar hides its theme switch below 640px. */}
					<div className="sm:hidden">
						<ThemeToggle data-id="app-footer-theme" />
					</div>
				</div>
			</div>
			<FeedbackForm
				open={open}
				onOpenChange={setOpen}
				source={feedbackSourceFor(pathname)}
			/>
		</footer>
	);
}
