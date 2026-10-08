import { Link, Outlet } from "react-router";
import { Wordmark } from "../brand/wordmark";
import { ThemeToggle } from "../theme/theme-toggle";

/** Sticky top bar with wordmark and theme switch; routes render below. */
export function AppLayout() {
	return (
		<>
			<header
				data-id="topbar"
				className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 backdrop-blur-md"
			>
				<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter">
					<Link
						to="/"
						data-id="topbar-home"
						aria-label="Localman — trang chủ"
						className="rounded-sm no-underline"
					>
						<Wordmark />
					</Link>
					<ThemeToggle data-id="topbar-theme" />
				</div>
			</header>
			<main className="mx-auto w-full max-w-page px-gutter pt-8 pb-16">
				<Outlet />
			</main>
		</>
	);
}
