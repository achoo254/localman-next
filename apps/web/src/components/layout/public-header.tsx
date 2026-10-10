import { Link, useLocation } from "react-router";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { ThemeToggle } from "../theme/theme-toggle";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";

const GHOST_SM = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"no-underline",
);

/**
 * Top bar of public pages (landing, pricing, invite, docs). Signed-in
 * visitors get "Open app" and their account menu instead of the sign-in
 * pair; while the session loads the pair shows, as on the prerendered
 * pages, and the bar keeps its height when they swap. At 375px only the
 * wordmark, "Sign in" and "Get started" fit; Docs, the language and theme
 * switches return from 640px (all are in the footer below that). The
 * landing's navigation (Features anchor, Pricing page) needs 1024px: at
 * 768px it would push the bar past its width.
 */
export function PublicHeader() {
	const t = useT();
	const { pathname, search } = useLocation();
	const session = useCurrentUser();
	const onLanding = pathname === "/";
	// Sign-in from a public page comes back to it (an invite, a docs page);
	// from the landing it goes to the projects.
	const returnTo = onLanding ? "/projects" : `${pathname}${search}`;
	return (
		<header
			data-id="topbar"
			className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 backdrop-blur-md"
		>
			<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter">
				<Link
					to="/"
					data-id="topbar-home"
					aria-label={t("layout.publicHeader.home")}
					className="rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				{onLanding ? (
					<nav
						aria-label={t("layout.publicHeader.nav")}
						className="flex items-center gap-1 max-lg:hidden"
					>
						<a href="#features" data-id="topbar-features" className={GHOST_SM}>
							{t("layout.publicHeader.features")}
						</a>
						<Link to="/pricing" data-id="topbar-pricing" className={GHOST_SM}>
							{t("layout.pricing")}
						</Link>
					</nav>
				) : null}
				<div className="flex items-center gap-2">
					<Link
						to="/docs"
						data-id="topbar-docs"
						className={cn(GHOST_SM, "max-sm:hidden")}
					>
						{t("layout.docs")}
					</Link>
					<div className="max-sm:hidden">
						<LanguageSwitcher data-id="topbar-language" compact />
					</div>
					<div className="max-sm:hidden">
						<ThemeToggle data-id="topbar-theme" />
					</div>
					{session.status === "authenticated" ? (
						<>
							<Link
								to="/projects"
								data-id="topbar-projects"
								className={cn(
									buttonClassName({ variant: "primary", size: "sm" }),
									"no-underline",
								)}
							>
								{t("common.cta.openApp")}
							</Link>
							<AccountControls user={session.user} />
						</>
					) : (
						<>
							<LoginLink
								returnTo={returnTo}
								data-id="topbar-login"
								className={GHOST_SM}
							>
								{t("layout.publicHeader.signIn")}
							</LoginLink>
							<LoginLink
								returnTo={returnTo}
								prompt="create"
								data-id="topbar-signup"
								// The short label below 640px is part of the long one, so
								// the accessible name still contains the visible text.
								aria-label={t("common.cta.startFree")}
								className={cn(
									buttonClassName({ variant: "primary", size: "sm" }),
									"no-underline",
								)}
							>
								<span className="sm:hidden">{t("common.cta.start")}</span>
								<span className="max-sm:hidden">
									{t("common.cta.startFree")}
								</span>
							</LoginLink>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
