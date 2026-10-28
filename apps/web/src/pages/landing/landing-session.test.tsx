import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import { makeUser } from "../../test/fixtures";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

const SIGNED_IN: Record<string, MockRoute> = {
	"GET /api/v1/users/me": { body: makeUser() },
	"GET /api/v1/notifications": {
		body: { items: [], nextCursor: null, unreadCount: 0 },
	},
	"GET /api/v1/projects": { body: { items: [] } },
};

const SIGN_IN_HREF = `/auth/login?returnTo=${encodeURIComponent("/projects")}`;

/** The public top bar of the shared shell, or the signed-in one. */
function topbar(): HTMLElement {
	const bar = document.querySelector(
		'header[data-id="public-header"], header[data-id="topbar"]',
	);
	if (!(bar instanceof HTMLElement)) throw new Error("no top bar");
	return bar;
}

function byDataId(id: string): HTMLElement {
	const element = document.querySelector(`[data-id="${id}"]`);
	if (!(element instanceof HTMLElement)) throw new Error(`no ${id}`);
	return element;
}

beforeEach(() => {
	resetCurrentUserCache();
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	// axe probes fonts through canvas, which jsdom lacks.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("landing at / by session", () => {
	it("shows the landing with Open app to a signed-in user, without a redirect", async () => {
		mockFetch(SIGNED_IN);
		const { router } = renderRoutes(routes, "/");
		const bar = within(topbar());
		expect(await bar.findByRole("link", { name: "Open app" })).toHaveAttribute(
			"href",
			"/projects",
		);
		expect(
			bar.getByRole("button", { name: "Minh Anh · Account" }),
		).toBeVisible();
		expect(bar.queryByRole("link", { name: "Sign in" })).toBeNull();
		// The sign-in card gives way to the product preview.
		expect(document.querySelector('[data-id="sign-in-card"]')).toBeNull();
		expect(byDataId("landing-hero-preview")).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/");
	});

	it("offers visitors Sign in and the one sign-in card", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/");
		const bar = within(topbar());
		expect(await bar.findByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/login",
		);
		expect(bar.queryByRole("link", { name: "Open app" })).toBeNull();
		expect(byDataId("sign-in-cta")).toHaveAttribute("href", SIGN_IN_HREF);
		expect(byDataId("sign-in-cta")).toHaveAccessibleName(
			"Sign in with hoandat.com",
		);
		expect(
			screen.queryByRole("link", { name: /Get started|Start free/ }),
		).toBeNull();
	});

	it("paints the visitor's landing at once while the session loads", async () => {
		mockFetch({
			"GET /api/v1/users/me": () => new Promise<never>(() => undefined),
		});
		renderRoutes(routes, "/");
		expect(
			await screen.findByRole("heading", { level: 1 }),
		).toBeInTheDocument();
		expect(
			within(topbar()).getByRole("link", { name: "Sign in" }),
		).toBeVisible();
		expect(byDataId("sign-in-cta")).toBeInTheDocument();
	});

	it("has no serious axe violations once signed in", async () => {
		mockFetch(SIGNED_IN);
		const { container } = renderRoutes(routes, "/");
		await within(topbar()).findByRole("link", { name: "Open app" });
		expect(await seriousViolations(container)).toEqual([]);
	});
});

describe("links back to the landing, never to pricing", () => {
	it("keeps the app wordmark on Projects and offers home in the account menu", async () => {
		mockFetch(SIGNED_IN);
		const { router } = renderRoutes(routes, "/projects");
		await screen.findByRole("heading", { name: "Projects" });
		expect(byDataId("topbar-home")).toHaveAttribute("href", "/projects");

		await userEvent.click(
			within(topbar()).getByRole("button", { name: "Minh Anh · Account" }),
		);
		expect(
			await screen.findByRole("menuitem", { name: "Localman home" }),
		).toBeVisible();
		expect(screen.queryByRole("menuitem", { name: "Pricing" })).toBeNull();
		await userEvent.click(
			screen.getByRole("menuitem", { name: "Localman home" }),
		);
		expect(router.state.location.pathname).toBe("/");
	});

	it.each([
		["/", { "GET /api/v1/users/me": UNAUTHENTICATED }],
		["/projects", SIGNED_IN],
	])(
		"puts the brand's home, and no pricing, in the footer on %s",
		async (path, api) => {
			mockFetch(api);
			renderRoutes(routes, path);
			const footer = within(await screen.findByRole("contentinfo"));
			expect(
				await footer.findByRole("link", { name: "An app from hoandat.com" }),
			).toHaveAttribute("href", "https://hoandat.com");
			expect(footer.queryByRole("link", { name: "Pricing" })).toBeNull();
		},
	);
});
