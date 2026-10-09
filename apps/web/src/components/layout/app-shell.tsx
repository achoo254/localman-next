import { Outlet } from "react-router";
import { RequireAuth } from "../../features/auth/route-guards";
import { AppHeader } from "./app-header";

/** Layout for signed-in pages; unauthenticated visitors go to the IdP. */
export function AppShell() {
	return (
		<RequireAuth>
			{(user) => (
				<>
					<AppHeader user={user} />
					<main className="mx-auto w-full max-w-page px-gutter pt-8 pb-16">
						<Outlet />
					</main>
				</>
			)}
		</RequireAuth>
	);
}
