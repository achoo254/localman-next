import { screen } from "@testing-library/react";
import { Outlet, type RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

function withFlags(apiClient: boolean): RouteObject[] {
	return [
		{
			element: (
				<FeaturesContext value={{ ...NO_FEATURES, apiClient }}>
					<Outlet />
				</FeaturesContext>
			),
			children: routes,
		},
	];
}

const SIGNED_IN = {
	"GET /api/v1/users/me": { body: makeUser() },
	"GET /api/v1/notifications": {
		body: { items: [], nextCursor: null, unreadCount: 0 },
	},
	"GET /api/v1/projects": { body: { items: [] } },
	"GET /api/v1/client/drafts": { body: { items: [] } },
};

describe("/api-client", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("opens the full-height workbench without the footer, linked from the top bar", async () => {
		mockFetch(SIGNED_IN);
		renderRoutes(withFlags(true), "/api-client");
		expect(
			await screen.findByRole("heading", { name: "API Client" }),
		).toBeInTheDocument();
		expect(document.querySelector('[data-id="workbench"]')).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "API Client" })).toHaveAttribute(
			"href",
			"/api-client",
		);
		expect(document.querySelector('[data-id="app-footer"]')).toBeNull();
		expect(document.title).toBe("API Client · Localman");
	});

	it("is hidden while the apiClient flag is off", async () => {
		mockFetch(SIGNED_IN);
		const { router } = renderRoutes(withFlags(false), "/api-client");
		expect(
			await screen.findByRole("heading", { name: "Projects" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/projects");
		expect(
			screen.queryByRole("link", { name: "API Client" }),
		).not.toBeInTheDocument();
	});
});
