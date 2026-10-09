import { Link, useLocation } from "react-router";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { ThemeToggle } from "../theme/theme-toggle";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";

/** In-page anchors of the landing, shown in the top bar on `/` only. */
const LANDING_ANCHORS = [
	{ href: "#features", label: "Tính năng", id: "topbar-features" },
	{ href: "#compare", label: "So sánh", id: "topbar-compare" },
	{ href: "#pricing", label: "Bảng giá", id: "topbar-pricing" },
] as const;

const GHOST_SM = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"no-underline",
);

/**
 * Top bar of public pages (landing, invite, docs). Signed-in visitors (on
 * docs or an invite) get "Projects" and their account menu instead of the
 * sign-in pair; while the session loads the pair shows, as on the
 * prerendered landing. At 375px only the
 * wordmark, "Đăng nhập" and "Bắt đầu" fit; Docs and the theme switch
 * return from 640px (both are in the footer below that). The landing
 * anchors need 1024px: at 768px they would push the bar past its width.
 */
export function PublicHeader() {
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
					aria-label="Localman, về trang chủ"
					className="rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				{onLanding ? (
					<nav
						aria-label="Điều hướng chính"
						className="flex items-center gap-1 max-lg:hidden"
					>
						{LANDING_ANCHORS.map((anchor) => (
							<a
								key={anchor.id}
								href={anchor.href}
								data-id={anchor.id}
								className={GHOST_SM}
							>
								{anchor.label}
							</a>
						))}
					</nav>
				) : null}
				<div className="flex items-center gap-2">
					<Link
						to="/docs"
						data-id="topbar-docs"
						className={cn(GHOST_SM, "max-sm:hidden")}
					>
						Docs
					</Link>
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
								Projects
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
								Đăng nhập
							</LoginLink>
							<LoginLink
								returnTo={returnTo}
								prompt="create"
								data-id="topbar-signup"
								className={cn(
									buttonClassName({ variant: "primary", size: "sm" }),
									"no-underline",
								)}
							>
								Bắt đầu
								<span className="max-sm:hidden"> miễn phí</span>
							</LoginLink>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
