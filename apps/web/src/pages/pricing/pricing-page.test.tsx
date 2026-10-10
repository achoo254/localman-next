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

function signedIn(plan: "free" | "pro"): Record<string, MockRoute> {
	return {
		"GET /api/v1/users/me": { body: makeUser({ plan }) },
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
		"GET /api/v1/projects": { body: { items: [] } },
	};
}

function card(plan: "free" | "pro"): HTMLElement {
	const element = document.querySelector(`[data-id="pricing-card-${plan}"]`);
	if (!(element instanceof HTMLElement)) throw new Error(`no ${plan} card`);
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

describe("/pricing", () => {
	it("shows the plans to a visitor with sign-up and a page title", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		const { container } = renderRoutes(routes, "/pricing");
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Start free, upgrade when you need to",
			}),
		).toBeInTheDocument();
		expect(document.title).toBe("Pricing · Localman");
		expect(
			await screen.findByRole("link", { name: "Sign in" }),
		).toHaveAttribute("href", "/auth/login?returnTo=%2Fpricing");
		expect(
			within(card("free")).getByRole("link", { name: "Get started free" }),
		).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects&prompt=create");
		expect(screen.queryByText("Current plan")).toBeNull();
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("marks a signed-in user's current plan and opens the app", async () => {
		mockFetch(signedIn("free"));
		const { container } = renderRoutes(routes, "/pricing");
		expect(await within(card("free")).findByText("Current plan")).toBeVisible();
		expect(
			within(card("free")).getByRole("link", { name: "Open app" }),
		).toHaveAttribute("href", "/projects");
		expect(screen.queryByRole("link", { name: /Get started/ })).toBeNull();
		expect(
			within(card("pro")).getByRole("button", { name: "Start 30-day trial" }),
		).toBeVisible();
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("marks Pro as current for a Pro user", async () => {
		mockFetch(signedIn("pro"));
		renderRoutes(routes, "/pricing");
		expect(
			await within(card("pro")).findByText("Current plan", {
				selector: '[data-id="pricing-card-current"]',
			}),
		).toBeVisible();
		expect(within(card("free")).queryByText("Current plan")).toBeNull();
	});

	it("is linked from the plan dialog, which closes on the way", async () => {
		mockFetch(signedIn("free"));
		const { router } = renderRoutes(routes, "/projects");
		await screen.findByRole("heading", { name: "Projects" });
		await userEvent.click(
			screen.getByRole("button", { name: "Minh Anh · Account" }),
		);
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Manage plan" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Manage plan" });
		await userEvent.click(
			within(dialog).getByRole("link", { name: "See pricing" }),
		);
		expect(router.state.location.pathname).toBe("/pricing");
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			await screen.findByRole("heading", { level: 1, name: /Start free/ }),
		).toBeInTheDocument();
	});
});
