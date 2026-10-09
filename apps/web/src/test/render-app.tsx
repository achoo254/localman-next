import { render } from "@testing-library/react";
import {
	type RouteObject,
	RouterProvider,
	createMemoryRouter,
} from "react-router";
import { ToastProvider } from "../components/ui/toast";
import { TooltipProvider } from "../components/ui/tooltip";

/** Renders routes in a memory router under the app-level providers. */
export function renderRoutes(routes: RouteObject[], initialPath: string) {
	const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
	const result = render(
		<TooltipProvider>
			<ToastProvider>
				<RouterProvider router={router} />
			</ToastProvider>
		</TooltipProvider>,
	);
	return { ...result, router };
}
