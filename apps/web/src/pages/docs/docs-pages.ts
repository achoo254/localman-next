/** One page of the public docs, in reading order. */
export interface DocsPage {
	/** Path segment under `/docs`. */
	readonly slug: string;
	readonly title: string;
	/** One line under the title in the table of contents. */
	readonly summary: string;
}

/**
 * The docs in reading order: the table of contents and the previous/next
 * links both follow this list. `routes.tsx` mounts the same slugs; a test
 * renders every one of them through the real route table.
 */
export const DOCS_PAGES: readonly DocsPage[] = [
	{
		slug: "quick-start",
		title: "Quick start",
		summary: "Từ project trống tới API gọi được",
	},
	{
		slug: "code-examples",
		title: "Code examples",
		summary: "fetch, axios và curl",
	},
	{
		slug: "custom-responses",
		title: "Custom responses",
		summary: "Đổi hình dạng body trả về",
	},
];

export function docsPath(slug: string): string {
	return `/docs/${slug}`;
}

/** Previous and next page of `slug` in reading order. */
export function docsNeighbours(slug: string): {
	previous: DocsPage | null;
	next: DocsPage | null;
} {
	const index = DOCS_PAGES.findIndex((page) => page.slug === slug);
	if (index === -1) return { previous: null, next: null };
	return {
		previous: DOCS_PAGES[index - 1] ?? null,
		next: DOCS_PAGES[index + 1] ?? null,
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
