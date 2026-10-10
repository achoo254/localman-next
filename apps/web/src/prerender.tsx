import { FREE_LIMITS } from "@localman/shared/constants";
import { prerender } from "react-dom/static";
import {
	StaticRouterProvider,
	createStaticHandler,
	createStaticRouter,
} from "react-router";
import { AppProviders } from "./app-providers";
import { en } from "./i18n/messages/en/dictionary";
import { createTranslator } from "./i18n/translate";
import { createQueryClient } from "./lib/query-client";
import { appTitle } from "./lib/use-document-title";
import { routes } from "./routes";

/** English head of a prerendered page, for crawlers and link previews. */
export interface PageHead {
	title: string;
	description: string;
}

export interface PrerenderedPage {
	path: string;
	/** File of `dist/` the build writes, served for `path` (nginx). */
	file: string;
	/** Null keeps the head of `index.html` (the landing's, checked by its test). */
	head: PageHead | null;
}

/** Public pages written as HTML at build time, so crawlers read them without JS. */
export function prerenderedPages(): PrerenderedPage[] {
	const { t } = createTranslator("en", en);
	return [
		{ path: "/", file: "index.html", head: null },
		{
			path: "/pricing",
			file: "pricing.html",
			head: {
				title: appTitle(t("layout.pricing")),
				description: t("landing.meta.pricingDescription", {
					projects: FREE_LIMITS.projects,
				}),
			},
		},
	];
}

/**
 * Markup of `path` for an anonymous visitor with this build's feature
 * flags. The browser hydrates it with the same providers and routes.
 */
export async function renderPageHtml(path: string): Promise<string> {
	const handler = createStaticHandler(routes);
	const context = await handler.query(new Request(`http://localhost${path}`));
	if (context instanceof Response) {
		throw new Error(`Prerender of ${path} got a ${context.status} response`);
	}
	const router = createStaticRouter(handler.dataRoutes, context);
	const { prelude } = await prerender(
		<AppProviders queryClient={createQueryClient()}>
			<StaticRouterProvider router={router} context={context} hydrate={false} />
		</AppProviders>,
	);
	return new Response(prelude).text();
}

function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

const HEAD_PATTERNS: ReadonlyArray<[RegExp, keyof PageHead]> = [
	[/(<title>)[^<]*(<\/title>)/, "title"],
	[/(<meta\s+name="description"\s+content=")[^"]*(")/, "description"],
	[/(<meta\s+property="og:title"\s+content=")[^"]*(")/, "title"],
	[/(<meta\s+property="og:description"\s+content=")[^"]*(")/, "description"],
];

/** Swaps the title and description tags of `index.html` for `head`'s. */
export function applyPageHead(html: string, head: PageHead): string {
	return HEAD_PATTERNS.reduce((result, [pattern, field]) => {
		if (!pattern.test(result)) {
			throw new Error(`index.html has no tag matching ${pattern}`);
		}
		return result.replace(
			pattern,
			(_match, open: string, close: string) =>
				`${open}${escapeHtml(head[field])}${close}`,
		);
	}, html);
}

const APP_MOUNT = '<div id="app"></div>';

/**
 * Each prerendered page as a whole HTML file built from `template` (the
 * built `index.html`): its markup inside `#app`, marked with the path it
 * belongs to (the inline script of `index.html` drops it on any other
 * path), and its own head.
 */
export async function renderPrerenderedFiles(
	template: string,
): Promise<Array<{ file: string; html: string }>> {
	if (!template.includes(APP_MOUNT)) {
		throw new Error(`index.html has no ${APP_MOUNT}`);
	}
	const files: Array<{ file: string; html: string }> = [];
	for (const page of prerenderedPages()) {
		const markup = await renderPageHtml(page.path);
		if (markup === "") throw new Error(`Prerender of ${page.path} is empty`);
		const mounted = template.replace(
			APP_MOUNT,
			`<div id="app" data-prerendered="${escapeHtml(page.path)}">${markup}</div>`,
		);
		files.push({
			file: page.file,
			html: page.head ? applyPageHead(mounted, page.head) : mounted,
		});
	}
	return files;
}
