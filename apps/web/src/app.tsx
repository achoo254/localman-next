import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { createQueryClient } from "./lib/query-client";
import { router } from "./router";

const queryClient = createQueryClient();

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ToastProvider>
					<RouterProvider router={router} />
				</ToastProvider>
			</TooltipProvider>
		</QueryClientProvider>
	);
}
