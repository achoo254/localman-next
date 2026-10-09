import { Outlet } from "react-router";
import { RequireAuth } from "../../features/auth/route-guards";
import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { MAIN_CLASS, MAIN_ID, SkipLink } from "./skip-link";

/**
 * Layout for signed-in pages (header, page, footer with the feedback
 * form); unauthenticated visitors go to the IdP.
 */
export function AppShell() {
	return (
		<RequireAuth>
			{(user) => (
				<>
					<SkipLink />
					<AppHeader user={user} />
					<main id={MAIN_ID} tabIndex={-1} className={MAIN_CLASS}>
						<Outlet />
					</main>
					<AppFooter />
				</>
			)}
		</RequireAuth>
	);
}
