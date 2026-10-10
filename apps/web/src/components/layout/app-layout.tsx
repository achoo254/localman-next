import { Outlet } from "react-router";
import { RouteProgress } from "../ui/route-progress";
import { AppFooter } from "./app-footer";
import { PublicHeader } from "./public-header";
import { MAIN_CLASS, MAIN_ID, SkipLink } from "./skip-link";

/**
 * Public layout: skip link, sticky top bar with sign-in, routes below,
 * and the footer with the feedback form. The route bar runs along the top
 * of the window while a page loads.
 */
export function AppLayout() {
	return (
		<>
			<RouteProgress />
			<SkipLink />
			<PublicHeader />
			<main id={MAIN_ID} tabIndex={-1} className={MAIN_CLASS}>
				<Outlet />
			</main>
			<AppFooter />
		</>
	);
}
