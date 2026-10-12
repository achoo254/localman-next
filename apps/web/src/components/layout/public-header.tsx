import { Link, useLocation } from "react-router";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { ThemeToggle } from "../theme/theme-toggle";
import { GHOST_SM, PublicAccountSlot } from "./public-account-slot";

/**
 * Top bar of public pages (landing, invite, docs). Signed-in
 * visitors get "Open app" and their account menu instead of the sign-in
 * pair, in a slot that keeps its size when they swap (PublicAccountSlot).
 * At 375px only the wordmark, "Sign in" and "Get started" fit; Docs, the
 * language and theme switches return from 640px (all are in the footer
 * below that). The
 * landing's navigation (Features anchor) needs 1024px: at
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
					<PublicAccountSlot session={session} returnTo={returnTo} />
				</div>
			</div>
		</header>
	);
}
