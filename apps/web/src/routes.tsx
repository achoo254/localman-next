import { type ComponentType, Suspense, lazy } from "react";
import type { RouteObject } from "react-router";
import { AppLayout } from "./components/layout/app-layout";
import { AppShell } from "./components/layout/app-shell";
import { PageLoading } from "./components/layout/page-loading";
import { RedirectIfAuthenticated } from "./features/auth/route-guards";
import { LandingPage } from "./pages/landing/landing-page";

/**
 * Page code split into its own chunk, loaded on first visit. The landing and
 * the shell (header, guards) stay in the main chunk so the first paint and
 * the session check do not wait for a second request.
 */
function lazyPage<K extends string>(
	load: () => Promise<Record<K, ComponentType>>,
	name: K,
) {
	const Page = lazy(async () => {
		const page: ComponentType = (await load())[name];
		return { default: page };
	});
	return (
		<Suspense fallback={<PageLoading />}>
			<Page />
		</Suspense>
	);
}

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
			// Public on purpose: anonymous visitors choose sign-in or sign-up
			// and come back here (the shell's guard would go straight to sign-in).
			{
				path: "invite/:token",
				element: lazyPage(
					() => import("./pages/accept-invite-page"),
					"AcceptInvitePage",
				),
			},
			// Design-system reference page kept for comparing with the prototype.
			{
				path: "_primitives",
				element: lazyPage(
					() => import("./pages/primitives/primitives-page"),
					"PrimitivesPage",
				),
			},
		],
	},
	{
		element: <AppShell />,
		children: [
			{
				path: "projects/*",
				element: lazyPage(
					() => import("./pages/projects/projects-page"),
					"ProjectsPage",
				),
			},
			{
				path: "projects/:projectId",
				element: lazyPage(
					() => import("./pages/project-detail/project-detail-page"),
					"ProjectDetailPage",
				),
			},
			{
				path: "account",
				element: lazyPage(
					() => import("./pages/account/account-page"),
					"AccountPage",
				),
			},
			{
				path: "account/notifications",
				element: lazyPage(
					() => import("./features/notifications/notification-settings-page"),
					"NotificationSettingsPage",
				),
			},
			{
				path: "admin/pro-interest",
				element: lazyPage(
					() => import("./pages/admin/pro-interest-page"),
					"ProInterestPage",
				),
			},
		],
	},
];
