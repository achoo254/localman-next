import { prerender } from "react-dom/static";
import {
	StaticRouterProvider,
	createStaticHandler,
	createStaticRouter,
} from "react-router";
import { AppProviders } from "./app-providers";
import { createQueryClient } from "./lib/query-client";
import { routes } from "./routes";

/**
 * Markup of `/` for an anonymous visitor with this build's feature flags,
 * written into `dist/index.html` by the build (see vite.config.ts) so the
 * landing paints before any JavaScript runs. The browser hydrates it with
 * the same providers and routes.
 */
export async function renderLandingHtml(): Promise<string> {
	const handler = createStaticHandler(routes);
	const context = await handler.query(new Request("http://localhost/"));
	if (context instanceof Response) {
		throw new Error(`Landing prerender got a ${context.status} response`);
	}
	const router = createStaticRouter(handler.dataRoutes, context);
	const { prelude } = await prerender(
		<AppProviders queryClient={createQueryClient()}>
			<StaticRouterProvider router={router} context={context} hydrate={false} />
		</AppProviders>,
	);
	return new Response(prelude).text();
}
