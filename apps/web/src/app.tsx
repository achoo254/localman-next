import { RouterProvider } from "react-router/dom";
import { AppProviders } from "./app-providers";
import { createQueryClient } from "./lib/query-client";
import { router } from "./router";

const queryClient = createQueryClient();

export function App() {
	return (
		<AppProviders queryClient={queryClient}>
			<RouterProvider router={router} />
		</AppProviders>
	);
}
