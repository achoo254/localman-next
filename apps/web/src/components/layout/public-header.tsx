import { Link, useLocation } from "react-router";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { PublicAccountSlot, TAP_TARGET } from "./public-account-slot";

/**
 * `.topbar-link` of the account app (auth-next static/css/app.css): small
 * mono label, a tinted pill for the current page.
 */
const TOPBAR_LINK = cn(
	"whitespace-nowrap rounded-sm px-3 py-2 font-mono font-semibold text-[0.8125rem] text-muted no-underline transition-colors",
	"hover:bg-fg/6 hover:text-fg aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary",
	"max-[479px]:px-2 max-[379px]:px-1",
	TAP_TARGET,
);

/**
 * Top bar of public pages (landing, invite, docs, tools, legal), laid out
 * like the account app at auth.<domain>, the base of every app of the
 * brand: the mark and name on the left, then small links (Features on the
 * landing, Docs) and the sign-in pair on the right. Signed-in visitors get
 * "Open app" and their account menu instead, in a slot that keeps its size
 * when they swap (PublicAccountSlot). The language and theme switches are
 * in the footer, as on the account app. Below 640px only the name and the
 * sign-in pair fit; Docs is in the footer there.
 */
export function PublicHeader() {
	const t = useT();
	const { pathname, search } = useLocation();
	const session = useCurrentUser();
	const onLanding = pathname === "/";
	const onDocs = pathname === "/docs" || pathname.startsWith("/docs/");
	// Sign-in from a public page comes back to it (an invite, a docs page);
	// from the landing it goes to the projects.
	const returnTo = onLanding ? "/projects" : `${pathname}${search}`;
	return (
		<header
			data-id="topbar"
			className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 pt-[env(safe-area-inset-top)] backdrop-blur-md"
		>
			<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter max-[359px]:gap-2">
				<Link
					to="/"
					data-id="topbar-home"
					aria-label={t("layout.publicHeader.home")}
					className="inline-flex min-h-11 items-center rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				<div className="flex items-center gap-1">
					<nav
						aria-label={t("layout.publicHeader.nav")}
						className="flex items-center gap-1 max-sm:hidden"
					>
						{onLanding ? (
							<a
								href="#features"
								data-id="topbar-features"
								className={TOPBAR_LINK}
							>
								{t("layout.publicHeader.features")}
							</a>
						) : null}
						<Link
							to="/docs"
							data-id="topbar-docs"
							aria-current={onDocs ? "page" : undefined}
							className={TOPBAR_LINK}
						>
							{t("layout.docs")}
						</Link>
					</nav>
					<PublicAccountSlot session={session} returnTo={returnTo} />
				</div>
			</div>
		</header>
	);
}
