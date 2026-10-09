import { RouterProvider } from "react-router/dom";
import { AppProviders } from "./app-providers";
import type { LoadedLocale } from "./i18n/i18n-provider";
import { createQueryClient } from "./lib/query-client";
import { router } from "./router";

const queryClient = createQueryClient();

export function App({ i18n }: { i18n?: LoadedLocale }) {
	return (
		<AppProviders queryClient={queryClient} i18n={i18n}>
			<RouterProvider router={router} />
		</AppProviders>
	);
}
