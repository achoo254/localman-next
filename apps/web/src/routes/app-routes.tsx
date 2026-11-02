import { Navigate, type RouteObject } from "react-router";
import { WORKBENCH_HANDLE } from "../components/layout/app-shell";
import { lazyPage } from "./lazy-page";
import { workspaceRoutes } from "./workspace-routes";

/** Signed-in pages inside the app shell. */
export const appRoutes: RouteObject[] = [
	{
		path: "projects/*",
		element: lazyPage(
			() => import("../pages/projects/projects-page"),
			"ProjectsPage",
		),
	},
	{
		path: "projects/:projectId",
		element: lazyPage(
			() => import("../pages/project-detail/project-detail-page"),
			"ProjectDetailPage",
		),
	},
	// Full-height workbench without the footer (see AppShell).
	{
		path: "api-client",
		handle: WORKBENCH_HANDLE,
		element: lazyPage(
			() => import("../pages/api-client/api-client-page"),
			"ApiClientPage",
		),
	},
	{
		path: "account",
		element: lazyPage(
			() => import("../pages/account/account-page"),
			"AccountPage",
		),
	},
	{
		path: "account/notifications",
		element: lazyPage(
			() => import("../features/notifications/notification-settings-page"),
			"NotificationSettingsPage",
		),
	},
	// Admin pages of the plans, removed with them: old links open the inbox.
	{
		path: "admin/pro-interest",
		element: <Navigate to="/admin/feedback" replace />,
	},
	{
		path: "admin/feedback",
		element: lazyPage(
			() => import("../pages/admin/feedback-inbox-page"),
			"FeedbackInboxPage",
		),
	},
	{
		path: "admin/trial-extensions",
		element: <Navigate to="/admin/feedback" replace />,
	},
	// Guest link of a collection: its redacted copy, signed in (`publicSharing`).
	{
		path: "guest/:linkId",
		element: lazyPage(
			() => import("../pages/guest/guest-collection-page"),
			"GuestCollectionPage",
		),
	},
	...workspaceRoutes,
];
