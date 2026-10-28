import {
	PublicPage,
	type ShellAction,
	type ShellLink,
	type ShellLinkComponent,
} from "@achoo254/app-shell";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useFeatures } from "../../config/features";
import { LOGIN_PAGE_PATH } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { feedbackSourceFor } from "../../features/feedback/feedback-draft";
import { FeedbackForm } from "../../features/feedback/feedback-form";
import { useI18n } from "../../i18n/i18n-context";
import { useChooseLocale } from "../../i18n/use-choose-locale";
import { loginUrl } from "../../lib/api-url";
import { LEGAL_PATHS } from "../../lib/legal";
import { LEGACY_THEME_KEY, LOCALES } from "../../lib/shared-preferences";
import { navigateToLogin } from "../../platform/navigation";
import { RouteProgress } from "../ui/route-progress";
import { PublicAccountSlot } from "./public-account-slot";
import { SHELL_BRAND } from "./shell-brand";

/** Server routes (sign-in, API) load in the browser, not in the router. */
const SERVER_PATH = /^\/(?:auth|api)\//;

/** Localman's own pages open in place, without a reload. */
const RouterLink: ShellLinkComponent = ({ href, ...rest }) =>
	SERVER_PATH.test(href) ? (
		<a href={href} {...rest} />
	) : (
		<Link to={href} {...rest} />
	);

/**
 * Public layout (landing, sign-in, invitations, docs, tools, legal, shared
 * collections): the shared header, footer and frame of every hoandat.com
 * app (@achoo254/app-shell, which also gives the skip link and
 * `<main id="main">`) around the page. Sign-in from a page other than the
 * landing comes straight back to it; a signed-in visitor gets "Open app"
 * and their account menu. The route bar runs along the top of the window
 * while a page loads.
 */
export function AppLayout() {
	const { locale, t } = useI18n();
	const choose = useChooseLocale();
	const { secretVault } = useFeatures();
	const { pathname, search } = useLocation();
	const session = useCurrentUser();
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const onLanding = pathname === "/";
	const onLogin = pathname === LOGIN_PAGE_PATH;
	const onDocs = pathname === "/docs" || pathname.startsWith("/docs/");
	const returnTo = `${pathname}${search}`;
	const signInHere = !onLanding && !onLogin;

	const navLinks: ShellLink[] = [
		...(onLanding
			? [
					{
						href: "#features",
						label: t("layout.publicHeader.features"),
						dataId: "topbar-features",
						hideOnPhones: true,
					},
				]
			: []),
		{
			href: "/docs",
			label: t("layout.docs"),
			dataId: "topbar-docs",
			current: onDocs,
			hideOnPhones: true,
		},
	];
	const footerLinks: (ShellLink | ShellAction)[] = [
		{
			href: LEGAL_PATHS.accountDelete,
			label: t("legal.nav.deleteAccount"),
			dataId: "foot-delete-account",
			current: pathname === LEGAL_PATHS.accountDelete,
		},
		...(secretVault
			? [
					{
						href: LEGAL_PATHS.yourData,
						label: t("dataTransparency.nav"),
						dataId: "foot-your-data",
						current: pathname === LEGAL_PATHS.yourData,
					},
				]
			: []),
		{ href: "/docs", label: t("layout.docs"), dataId: "foot-docs" },
		// A button of the footer: "Feedback / Contact" opens the form in place.
		{
			label: t("layout.footer.feedback"),
			dataId: "foot-feedback",
			onClick: () => setFeedbackOpen(true),
		},
	];

	return (
		<>
			<RouteProgress />
			<PublicPage
				brand={SHELL_BRAND}
				locale={locale}
				locales={LOCALES}
				onLocaleChange={(next) => void choose(next)}
				// The landing and /login send sign-in to the card of /login;
				// any other page signs in at once and comes back to itself.
				signInHref={signInHere ? loginUrl({ returnTo }) : LOGIN_PAGE_PATH}
				onSignIn={signInHere ? () => navigateToLogin({ returnTo }) : undefined}
				signInCurrent={onLogin}
				accountSlot={
					session.status === "authenticated" ? (
						<PublicAccountSlot user={session.user} />
					) : undefined
				}
				navLinks={navLinks}
				privacyHref={LEGAL_PATHS.privacy}
				termsHref={LEGAL_PATHS.terms}
				footerLinks={footerLinks}
				legacyThemeKey={LEGACY_THEME_KEY}
				linkComponent={RouterLink}
				layout={onLogin ? "center" : "flow"}
			>
				{onLanding || onLogin ? (
					<Outlet />
				) : (
					<div className="pt-8 pb-16">
						<Outlet />
					</div>
				)}
			</PublicPage>
			<FeedbackForm
				open={feedbackOpen}
				onOpenChange={setFeedbackOpen}
				source={feedbackSourceFor(pathname)}
			/>
		</>
	);
}
