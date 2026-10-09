import type { RouteObject } from "react-router";
import { AppLayout } from "./components/layout/app-layout";
import { AppShell } from "./components/layout/app-shell";
import { RedirectIfAuthenticated } from "./features/auth/route-guards";
import { NotificationSettingsPage } from "./features/notifications/notification-settings-page";
import { LandingPage } from "./pages/landing/landing-page";
import { PrimitivesPage } from "./pages/primitives/primitives-page";
import { ProjectsPage } from "./pages/projects/projects-page";

/** Route table shared by the browser router and route tests. */
export const routes: RouteObject[] = [
	{
		path: "/",
		element: <AppLayout />,
		children: [
			{
				index: true,
				element: (
					<RedirectIfAuthenticated>
						<LandingPage />
					</RedirectIfAuthenticated>
				),
			},
			// Design-system reference page kept for comparing with the prototype.
			{ path: "_primitives", element: <PrimitivesPage /> },
		],
	},
	{
		element: <AppShell />,
		children: [
			{ path: "projects/*", element: <ProjectsPage /> },
			{
				path: "account/notifications",
				element: <NotificationSettingsPage />,
			},
		],
	},
];
