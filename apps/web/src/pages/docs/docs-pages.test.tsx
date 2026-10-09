import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import { en } from "../../i18n/messages/en/dictionary";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import { renderRoutes } from "../../test/render-app";
import {
	DOCS_PAGES,
	type DocsPage,
	docsPagesFor,
	docsPath,
} from "./docs-pages";

const WITH_MCP: FeatureFlags = { ...NO_FEATURES, mockMcp: true };

/** The real route table under these feature flags. */
function renderDocs(path: string, flags: FeatureFlags = NO_FEATURES) {
	return renderRoutes(
		[
			{
				element: (
					<FeaturesContext value={flags}>
						<Outlet />
					</FeaturesContext>
				),
				children: routes,
			},
		],
		path,
	);
}

const titleOf = (page: DocsPage): string => en.docs.pages[page.key].title;

beforeEach(() => {
	// axe probes fonts through canvas; jsdom has no scrolling.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	// jsdom has no layout, hence no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function toc(): HTMLElement {
	return screen.getByRole("navigation", { name: "Docs contents" });
}

function pager(): HTMLElement {
	return screen.getByRole("navigation", { name: "Previous and next page" });
}

describe("docs pages", () => {
	it.each(DOCS_PAGES.map((page) => [page.slug, page] as const))(
		"renders %s publicly with its title, table of contents and no serious axe violations",
		async (_slug, page) => {
			const { container } = renderDocs(docsPath(page.slug), WITH_MCP);
			expect(
				await screen.findByRole("heading", { level: 1, name: titleOf(page) }),
			).toBeInTheDocument();
			expect(document.title).toBe(`${titleOf(page)} · Localman docs`);

			const links = within(toc()).getAllByRole("link");
			expect(links.map((link) => link.getAttribute("href"))).toEqual(
				DOCS_PAGES.map((item) => docsPath(item.slug)),
			);
			const current = links.filter(
				(link) => link.getAttribute("aria-current") === "page",
			);
			expect(current).toHaveLength(1);
			expect(current[0]).toHaveAttribute("href", docsPath(page.slug));

			// Sections are h2 under the page's single h1.
			expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
			expect(
				screen.getAllByRole("heading", { level: 2 }).length,
			).toBeGreaterThan(0);
			expect(await seriousViolations(container)).toEqual([]);
		},
	);

	it("sends /docs to the first page", async () => {
		const { router } = renderDocs("/docs");
		expect(
			await screen.findByRole("heading", { level: 1, name: "Quick start" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/docs/quick-start");
	});

	it("walks the pages in order with the previous/next links", async () => {
		const { router } = renderDocs(docsPath("quick-start"));
		await screen.findByRole("heading", { level: 1, name: "Quick start" });
		expect(
			within(pager()).queryByRole("link", { name: /Previous/ }),
		).not.toBeInTheDocument();

		await userEvent.click(
			within(pager()).getByRole("link", { name: /Next.*Code examples/ }),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Code examples" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/docs/code-examples");
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
		expect(
			within(toc()).getByRole("link", { name: /Code examples/ }),
		).toHaveAttribute("aria-current", "page");

		await userEvent.click(
			within(pager()).getByRole("link", {
				name: /Next.*Custom responses/,
			}),
		);
		await screen.findByRole("heading", { level: 1, name: "Custom responses" });
		expect(
			within(pager()).queryByRole("link", { name: /Next/ }),
		).not.toBeInTheDocument();

		await userEvent.click(
			within(pager()).getByRole("link", { name: /Previous.*Code examples/ }),
		);
		await screen.findByRole("heading", { level: 1, name: "Code examples" });
	});

	it("opens a page at the section its link names", async () => {
		renderDocs(`${docsPath("quick-start")}#query`);
		const heading = await screen.findByRole("heading", {
			level: 2,
			name: "6. Filter, sort, paginate",
		});
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
		expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(
			heading,
		);
	});

	it("navigates from the table of contents and restores the title on leave", async () => {
		document.title = "Localman";
		const { router } = renderDocs(docsPath("quick-start"));
		await screen.findByRole("heading", { level: 1, name: "Quick start" });
		await userEvent.click(
			within(toc()).getByRole("link", { name: /Custom responses/ }),
		);
		await screen.findByRole("heading", { level: 1, name: "Custom responses" });
		expect(document.title).toBe("Custom responses · Localman docs");

		await router.navigate("/_primitives");
		await waitFor(() =>
			expect(
				screen.queryByRole("navigation", { name: "Docs contents" }),
			).toBeNull(),
		);
		expect(document.title).toBe("Localman");
	});

	it("hides the MCP page while Mock MCP is off", async () => {
		expect(docsPagesFor(NO_FEATURES).map((page) => page.slug)).not.toContain(
			"mcp",
		);
		const { router } = renderDocs(docsPath("mcp"));
		await screen.findByRole("heading", { level: 1, name: "Quick start" });
		expect(router.state.location.pathname).toBe("/docs/quick-start");
		expect(
			within(toc()).queryByRole("link", { name: /MCP tools/ }),
		).not.toBeInTheDocument();
		// The last page then has no "next" link.
		await router.navigate(docsPath("custom-responses"));
		await screen.findByRole("heading", { level: 1, name: "Custom responses" });
		expect(
			within(pager()).queryByRole("link", { name: /Next/ }),
		).not.toBeInTheDocument();
	});
});
