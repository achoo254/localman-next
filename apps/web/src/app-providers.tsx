import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, StrictMode } from "react";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";

/**
 * App-wide providers around the router. The browser app and the landing
 * prerender share this exact tree so hydration (and `useId`) match.
 */
export function AppProviders({
	queryClient,
	children,
}: {
	queryClient: QueryClient;
	children: ReactNode;
}) {
	return (
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<ToastProvider>{children}</ToastProvider>
				</TooltipProvider>
			</QueryClientProvider>
		</StrictMode>
	);
}
