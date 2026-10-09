import type { FeatureFlags, FeatureName } from "../../config/features";

/** One page of the public docs, in reading order. */
export interface DocsPage {
	/** Path segment under `/docs`. */
	readonly slug: string;
	/** Key of the title and summary under `docs.pages`. */
	readonly key: "quickStart" | "codeExamples" | "customResponses" | "mcp";
	/** Shown only when this feature runs in production. */
	readonly feature?: FeatureName;
}

/**
 * The docs in reading order: the table of contents and the previous/next
 * links both follow this list. `routes.tsx` mounts the same slugs; a test
 * renders every one of them through the real route table.
 */
export const DOCS_PAGES: readonly DocsPage[] = [
	{ slug: "quick-start", key: "quickStart" },
	{ slug: "code-examples", key: "codeExamples" },
	{ slug: "custom-responses", key: "customResponses" },
	{ slug: "mcp", key: "mcp", feature: "mockMcp" },
];

/** The pages a reader can open with these feature flags. */
export function docsPagesFor(flags: FeatureFlags): readonly DocsPage[] {
	return DOCS_PAGES.filter((page) => !page.feature || flags[page.feature]);
}

export function docsPath(slug: string): string {
	return `/docs/${slug}`;
}

/** Previous and next page of `slug` among `pages`, in reading order. */
export function docsNeighbours(
	pages: readonly DocsPage[],
	slug: string,
): {
	previous: DocsPage | null;
	next: DocsPage | null;
} {
	const index = pages.findIndex((page) => page.slug === slug);
	if (index === -1) return { previous: null, next: null };
	return {
		previous: pages[index - 1] ?? null,
		next: pages[index + 1] ?? null,
	};
}

/** Production mock domain (`MOCK_BASE_DOMAIN` of the API). */
export const MOCK_DOMAIN = "localman.hoandat.com";
/** Mock base URL as the docs write it, placeholders in braces. */
export const MOCK_URL_PATTERN = `https://{secret}.${MOCK_DOMAIN}{prefix}`;
/** Path fallback for networks that do not resolve the secret subdomain. */
export const MOCK_URL_FALLBACK = `https://${MOCK_DOMAIN}/m/{secret}{prefix}`;
/** Base URL the code examples start from; readers paste their secret. */
export const EXAMPLE_BASE_URL = `https://<secret>.${MOCK_DOMAIN}`;
/** Localman MCP endpoint of the dashboard, OAuth-protected. */
export const LOCALMAN_MCP_URL = `https://${MOCK_DOMAIN}/mcp`;
/** Shared sign-in (OAuth authorization server) of Localman MCP. */
export const IDP_HOST = "auth.hoandat.com";
