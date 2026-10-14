import { Navigate, type RouteObject } from "react-router";
import { LandingPage } from "../pages/landing/landing-page";
import { lazyPage } from "./lazy-page";

/** Pages of the public layout (landing, invitations, docs). */
export const publicRoutes: RouteObject[] = [
	// The landing stays reachable once signed in: its header and hero
	// turn into "Open app" instead of moving the user away.
	{ index: true, element: <LandingPage /> },
	// No pricing while the product is not sold; old links land home.
	{ path: "pricing", element: <Navigate to="/" replace /> },
	// Public on purpose: anonymous visitors choose sign-in or sign-up
	// and come back here (the shell's guard would go straight to sign-in).
	{
		path: "invite/:token",
		element: lazyPage(
			() => import("../pages/accept-invite-page"),
			"AcceptInvitePage",
		),
	},
	// Public like `/invite/:token`; redirects while `workspaces` is off.
	{
		path: "workspace-invite/:token",
		element: lazyPage(
			() => import("../features/workspaces/workspace-invite-page"),
			"WorkspaceInvitePage",
		),
	},
	// A collection published with a public link; read-only, no sign-in
	// (`publicSharing` flag, home otherwise).
	{
		path: "public/c/:linkId",
		element: lazyPage(
			() => import("../pages/public/public-collection-page"),
			"PublicCollectionPage",
		),
	},
	// "Run in Localman" badges land here; public so the page can explain
	// before asking to sign in (`publicSharing` flag, home otherwise).
	{
		path: "run/:buttonId",
		element: lazyPage(
			() => import("../pages/run/run-button-page"),
			"RunButtonPage",
		),
	},
	// Design-system reference page kept for comparing with the prototype.
	{
		path: "_primitives",
		element: lazyPage(
			() => import("../pages/primitives/primitives-page"),
			"PrimitivesPage",
		),
	},
	// Public docs; slugs and reading order live in pages/docs/docs-pages.ts.
	{
		path: "docs",
		element: lazyPage(() => import("../pages/docs/docs-layout"), "DocsLayout"),
		children: [
			{ index: true, element: <Navigate to="quick-start" replace /> },
			{
				path: "quick-start",
				element: lazyPage(
					() => import("../pages/docs/quick-start-page"),
					"QuickStartPage",
				),
			},
			{
				path: "code-examples",
				element: lazyPage(
					() => import("../pages/docs/code-examples-page"),
					"CodeExamplesPage",
				),
			},
			{
				path: "custom-responses",
				element: lazyPage(
					() => import("../pages/docs/custom-responses-page"),
					"CustomResponsesPage",
				),
			},
			{
				path: "mcp",
				element: lazyPage(
					() => import("../pages/docs/mcp-tools-page"),
					"McpToolsPage",
				),
			},
			{
				path: "public-sharing",
				element: lazyPage(
					() => import("../pages/docs/public-sharing-page"),
					"PublicSharingPage",
				),
			},
		],
	},
];
