import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { makeUser } from "../../test/fixtures";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

const SIGNED_IN: Record<string, MockRoute> = {
	"GET /api/v1/users/me": { body: makeUser({ isOwner: true }) },
	"GET /api/v1/notifications": {
		body: { items: [], nextCursor: null, unreadCount: 0 },
	},
	"GET /api/v1/projects": { body: { items: [] } },
	"GET /api/v1/admin/contact-messages": {
		body: { items: [], total: 0, page: 1, pageSize: 20 },
	},
};

/** Each route's page, found once it has rendered (lazy pages included). */
const CASES: [string, Record<string, MockRoute>, () => Promise<unknown>][] = [
	[
		"/",
		{ "GET /api/v1/users/me": UNAUTHENTICATED },
		() => screen.findAllByRole("link", { name: "Bắt đầu miễn phí" }),
	],
	[
		"/docs/quick-start",
		{ "GET /api/v1/users/me": UNAUTHENTICATED },
		() => screen.findByRole("heading", { level: 1 }),
	],
	[
		"/projects",
		SIGNED_IN,
		() => screen.findByRole("heading", { name: "Projects" }),
	],
	[
		"/admin/feedback",
		SIGNED_IN,
		() => screen.findByRole("heading", { name: "Quản trị · Hộp thư góp ý" }),
	],
];

describe("AppFooter placement", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it.each(CASES)(
		"%s has exactly one footer with the feedback link",
		async (path, api, pageReady) => {
			mockFetch(api);
			renderRoutes(routes, path);
			await pageReady();
			const footers = document.querySelectorAll('[data-id="app-footer"]');
			expect(footers).toHaveLength(1);
			const [footer] = footers;
			if (!(footer instanceof HTMLElement)) throw new Error("no footer");
			expect(
				within(footer).getByRole("button", { name: "Góp ý / Liên hệ" }),
			).toBeVisible();
		},
	);
});
