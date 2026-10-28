import { LanguageSwitch, ThemeSwitch } from "@achoo254/app-shell";
import { brand } from "@localman/shared/brand";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { feedbackSourceFor } from "../../features/feedback/feedback-draft";
import { FeedbackForm } from "../../features/feedback/feedback-form";
import { useI18n } from "../../i18n/i18n-context";
import { useChooseLocale } from "../../i18n/use-choose-locale";
import { cn } from "../../lib/cn";
import {
	LEGACY_THEME_KEY,
	LOCALES,
	PREFERENCE_DOMAIN,
} from "../../lib/shared-preferences";
import { LegalLinks } from "./legal-links";

/** 44px targets on touch screens and phones, as on the account app (pointer coarse or ≤ 479px). */
const TAP_TARGET =
	"pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center max-[479px]:inline-flex max-[479px]:min-h-11 max-[479px]:min-w-11 max-[479px]:items-center max-[479px]:justify-center";

/** `.foot-link` of the account app: a quiet 13px link, underlined on hover. */
const FOOT_LINK = cn(
	"cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[0.8125rem] text-muted no-underline underline-offset-2 hover:text-fg hover:underline",
	TAP_TARGET,
);

/**
 * Footer of the signed-in pages, laid out like the shared public footer:
 * the language and theme switches of every hoandat.com app
 * (@achoo254/app-shell, the same ones as on the public pages), then one
 * quiet row: "An app from <domain>" (the brand's home), the legal pages,
 * Docs and the "Feedback / Contact" form (in place of a contact email).
 */
export function AppFooter() {
	const { locale, t } = useI18n();
	const choose = useChooseLocale();
	const { pathname } = useLocation();
	const [open, setOpen] = useState(false);
	const domain = brand.primaryTenant.domain;
	return (
		<footer
			data-id="app-footer"
			className="mx-auto flex w-full max-w-page flex-col items-center gap-3 px-gutter pt-6 pb-[calc(var(--space-7)+env(safe-area-inset-bottom))]"
		>
			<div
				data-id="app-footer-switches"
				className="flex flex-wrap items-center justify-center gap-3"
			>
				<LanguageSwitch
					locale={locale}
					locales={LOCALES}
					domain={PREFERENCE_DOMAIN}
					onLocaleChange={(next) => void choose(next)}
				/>
				<ThemeSwitch
					locale={locale}
					domain={PREFERENCE_DOMAIN}
					legacyThemeKey={LEGACY_THEME_KEY}
				/>
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
