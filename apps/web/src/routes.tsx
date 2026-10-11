import type { RouteObject } from "react-router";
import { AppLayout } from "./components/layout/app-layout";
import { AppShell } from "./components/layout/app-shell";
import { appRoutes } from "./routes/app-routes";
import { publicRoutes } from "./routes/public-routes";

/**
 * Route table shared by the browser router and route tests. The
 * prerendered pages (landing, pricing) and the shell (header, guards) stay
 * in the main chunk; every other page is split (`routes/lazy-page.tsx`).
 */
export const routes: RouteObject[] = [
	{ path: "/", element: <AppLayout />, children: publicRoutes },
	{ element: <AppShell />, children: appRoutes },
];
