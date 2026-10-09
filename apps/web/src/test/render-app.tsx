import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import {
	type RouteObject,
	RouterProvider,
	createMemoryRouter,
} from "react-router";
import { ToastProvider } from "../components/ui/toast";
import { TooltipProvider } from "../components/ui/tooltip";

/** Fresh query cache per test, without retries so errors show at once. */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, refetchOnWindowFocus: false },
			mutations: { retry: false },
		},
	});
}

/** Renders routes in a memory router under the app-level providers. */
export function renderRoutes(routes: RouteObject[], initialPath: string) {
	const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
	const queryClient = createTestQueryClient();
	const result = render(
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ToastProvider>
					<RouterProvider router={router} />
				</ToastProvider>
			</TooltipProvider>
		</QueryClientProvider>,
	);
	return { ...result, router, queryClient };
}
