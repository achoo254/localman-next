import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import { renderRoutes } from "../../test/render-app";
import { DOCS_PAGES, docsPath } from "./docs-pages";

beforeEach(() => {
	// axe probes fonts through canvas; jsdom has no scrolling.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	// jsdom has no layout, hence no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function toc(): HTMLElement {
	return screen.getByRole("navigation", { name: "Mục lục tài liệu" });
}

function pager(): HTMLElement {
	return screen.getByRole("navigation", { name: "Trang trước và trang sau" });
}

describe("docs pages", () => {
	it.each(DOCS_PAGES.map((page) => [page.slug, page] as const))(
		"renders %s publicly with its title, table of contents and no serious axe violations",
		async (_slug, page) => {
			const { container } = renderRoutes(routes, docsPath(page.slug));
			expect(
				await screen.findByRole("heading", { level: 1, name: page.title }),
			).toBeInTheDocument();
			expect(document.title).toBe(`${page.title} · Tài liệu Localman`);

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
		const { router } = renderRoutes(routes, "/docs");
		expect(
			await screen.findByRole("heading", { level: 1, name: "Quick start" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/docs/quick-start");
	});

	it("walks the pages in order with the previous/next links", async () => {
		const { router } = renderRoutes(routes, docsPath("quick-start"));
		await screen.findByRole("heading", { level: 1, name: "Quick start" });
		expect(
			within(pager()).queryByRole("link", { name: /Trang trước/ }),
		).not.toBeInTheDocument();

		await userEvent.click(
			within(pager()).getByRole("link", { name: /Trang sau.*Code examples/ }),
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
				name: /Trang sau.*Custom responses/,
			}),
		);
		await screen.findByRole("heading", { level: 1, name: "Custom responses" });
		expect(
			within(pager()).queryByRole("link", { name: /Trang sau/ }),
		).not.toBeInTheDocument();

		await userEvent.click(
			within(pager()).getByRole("link", { name: /Trang trước.*Code examples/ }),
		);
		await screen.findByRole("heading", { level: 1, name: "Code examples" });
	});

	it("opens a page at the section its link names", async () => {
		renderRoutes(routes, `${docsPath("quick-start")}#query`);
		const heading = await screen.findByRole("heading", {
			level: 2,
			name: "6. Lọc, sắp xếp, phân trang",
		});
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
		expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(
			heading,
		);
	});

	it("navigates from the table of contents and restores the title on leave", async () => {
		document.title = "Localman";
		const { router } = renderRoutes(routes, docsPath("quick-start"));
		await screen.findByRole("heading", { level: 1, name: "Quick start" });
		await userEvent.click(
			within(toc()).getByRole("link", { name: /Custom responses/ }),
		);
		await screen.findByRole("heading", { level: 1, name: "Custom responses" });
		expect(document.title).toBe("Custom responses · Tài liệu Localman");

		await router.navigate("/_primitives");
		await waitFor(() =>
			expect(
				screen.queryByRole("navigation", { name: "Mục lục tài liệu" }),
			).toBeNull(),
		);
		expect(document.title).toBe("Localman");
	});
});
