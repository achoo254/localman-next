import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, StrictMode } from "react";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { I18nProvider, type LoadedLocale } from "./i18n/i18n-provider";

/**
 * App-wide providers around the router. The browser app and the landing
 * prerender share this exact tree so hydration (and `useId`) match.
 */
export function AppProviders({
	queryClient,
	i18n,
	children,
}: {
	queryClient: QueryClient;
	/** First language; English when omitted (prerender and hydration). */
	i18n?: LoadedLocale;
	children: ReactNode;
}) {
	return (
		<StrictMode>
			<I18nProvider initial={i18n}>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider>
						<ToastProvider>{children}</ToastProvider>
					</TooltipProvider>
				</QueryClientProvider>
			</I18nProvider>
		</StrictMode>
	);
}
