import type { FeatureFlags, FeatureName } from "../../config/features";
import {
	DEFAULT_TENANT_INFO,
	type TenantInfo,
	useTenantInfo,
} from "../../lib/tenant-info";

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

/** Mock domain the static docs are written for (the primary domain). */
export const MOCK_DOMAIN = DEFAULT_TENANT_INFO.mockBaseDomain;
/** Base URL the code examples start from; readers paste their secret. */
export const EXAMPLE_BASE_URL = `https://<secret>.${MOCK_DOMAIN}`;

/** Mock, MCP and sign-in addresses as the docs write them, for one domain. */
export interface DocsUrls {
	/** Mock base URL, placeholders in braces. */
	readonly mockUrlPattern: string;
	/** Path fallback for networks that do not resolve the secret subdomain. */
	readonly mockUrlFallback: string;
	/** Localman MCP endpoint of the dashboard, OAuth-protected. */
	readonly localmanMcpUrl: string;
	/** Shared sign-in (OAuth authorization server) of Localman MCP. */
	readonly idpHost: string;
}

export function docsUrlsOf(info: TenantInfo): DocsUrls {
	return {
		mockUrlPattern: `https://{secret}.${info.mockBaseDomain}{prefix}`,
		mockUrlFallback: `${info.publicUrl}/m/{secret}{prefix}`,
		localmanMcpUrl: `${info.publicUrl}/mcp`,
		idpHost: new URL(info.idpOrigin).host,
	};
}

/** The docs' addresses on the domain being read (the primary one at first). */
export function useDocsUrls(): DocsUrls {
	return docsUrlsOf(useTenantInfo());
}

/** Example code with the static docs' mock domain swapped for this one's. */
export function onThisDomain(code: string, info: TenantInfo): string {
	return code.replaceAll(MOCK_DOMAIN, info.mockBaseDomain);
}
