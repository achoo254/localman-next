import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { makeUser } from "../../test/fixtures";
import { UNAUTHENTICATED, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

/** The site top bar (docs pages have a header of their own too). */
function topbar(): HTMLElement {
	const bar = document.querySelector('header[data-id="topbar"]');
	if (!(bar instanceof HTMLElement)) throw new Error("no top bar");
	return bar;
}

describe("public top bar and skip link", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("offers Features, Pricing, Docs, sign-in and sign-up on /", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/");
		await screen.findByRole("heading", { level: 1 });
		const nav = within(topbar()).getByRole("navigation", {
			name: "Main navigation",
		});
		expect(
			within(nav)
				.getAllByRole("link")
				.map((link) => [link.textContent, link.getAttribute("href")]),
		).toEqual([
			["Features", "#features"],
			["Pricing", "/pricing"],
		]);
		expect(document.getElementById("features")).not.toBeNull();
		const bar = within(topbar());
		expect(bar.getByRole("link", { name: "Docs" })).toHaveAttribute(
			"href",
			"/docs",
		);
		expect(bar.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/auth/login?returnTo=%2Fprojects",
		);
		expect(bar.getByRole("link", { name: "Get started free" })).toHaveAttribute(
			"href",
			"/auth/login?returnTo=%2Fprojects&prompt=create",
		);
	});

	it("drops the landing anchors elsewhere and signs in back to the page", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/docs/quick-start");
		await screen.findByRole("heading", { level: 1 });
		expect(
			within(topbar()).queryByRole("navigation", { name: "Main navigation" }),
		).toBeNull();
		expect(
			within(topbar()).getByRole("link", { name: "Sign in" }),
		).toHaveAttribute("href", "/auth/login?returnTo=%2Fdocs%2Fquick-start");
	});

	it("gives signed-in readers of /docs Open app and their account menu", async () => {
		mockFetch({ "GET /api/v1/users/me": { body: makeUser() } });
		renderRoutes(routes, "/docs/quick-start");
		const bar = within(topbar());
		expect(await bar.findByRole("link", { name: "Open app" })).toHaveAttribute(
			"href",
			"/projects",
		);
		expect(bar.queryByRole("link", { name: "Sign in" })).toBeNull();
		expect(bar.queryByRole("link", { name: /^Get started/ })).toBeNull();
		await userEvent.click(
			bar.getByRole("button", { name: "Minh Anh · Account" }),
		);
		expect(
			await screen.findByRole("menuitem", { name: "Account and limits" }),
		).toBeVisible();
	});

	it.each([
		["/", { "GET /api/v1/users/me": UNAUTHENTICATED }],
		[
			"/account",
			{
				"GET /api/v1/users/me": { body: makeUser() },
				"GET /api/v1/notifications": {
					body: { items: [], nextCursor: null, unreadCount: 0 },
				},
				"GET /api/v1/account/usage": { status: 500, body: {} },
			},
		],
	])("lets keyboard users skip the top bar on %s", async (path, api) => {
		mockFetch(api);
		renderRoutes(routes, path);
		await screen.findByRole("heading", { level: 1 });
		await userEvent.tab();
		const skip = screen.getByRole("link", { name: "Skip to content" });
		expect(skip).toHaveFocus();
		expect(skip).toHaveAttribute("href", "#main");
		expect(screen.getByRole("main")).toHaveAttribute("id", "main");
	});

	it("names the tab after the signed-in page", async () => {
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/notifications": {
				body: { items: [], nextCursor: null, unreadCount: 0 },
			},
			"GET /api/v1/projects": { body: { items: [] } },
		});
		renderRoutes(routes, "/projects");
		await screen.findByRole("heading", { name: "Projects" });
		expect(document.title).toBe("Projects · Localman");
	});
});
