import type { RouteObject } from "react-router";
import { lazyPage } from "./lazy-page";

/** Workspace settings, Trash, shared-item links and access requests (`workspaces` flag). */
export const workspaceRoutes: RouteObject[] = [
	// Settings of the API client's current workspace (`workspaces` flag).
	{
		path: "workspace/settings",
		element: lazyPage(
			() => import("../features/workspaces/workspace-settings-page"),
			"WorkspaceSettingsPage",
		),
	},
	// Deleted collections to restore (`workspaces` flag).
	{
		path: "trash",
		element: lazyPage(
			() => import("../features/collections/trash-page"),
			"TrashPage",
		),
	},
	// Shared-item links and access requests (`workspaces` flag).
	{
		path: "elements/:type/:id",
		element: lazyPage(
			() => import("../features/sharing/element-link-page"),
			"ElementLinkPage",
		),
	},
	{
		path: "access-requests/:requestId",
		element: lazyPage(
			() => import("../features/sharing/access-request-page"),
			"AccessRequestPage",
		),
	},
];
