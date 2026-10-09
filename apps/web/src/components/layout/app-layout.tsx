import { Outlet } from "react-router";
import { AppFooter } from "./app-footer";
import { PublicHeader } from "./public-header";
import { MAIN_CLASS, MAIN_ID, SkipLink } from "./skip-link";

/**
 * Public layout: skip link, sticky top bar with sign-in, routes below,
 * and the footer with the feedback form.
 */
export function AppLayout() {
	return (
		<>
			<SkipLink />
			<PublicHeader />
			<main id={MAIN_ID} tabIndex={-1} className={MAIN_CLASS}>
				<Outlet />
			</main>
			<AppFooter />
		</>
	);
}
