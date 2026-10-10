import { vi } from "vitest";
import type { CurrentUser } from "../../features/auth/current-user";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { freezeTrialClock } from "../../features/subscription/trial-test-helpers";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { AccountPage } from "./account-page";

export function usage(overrides: Record<string, unknown> = {}) {
	return {
		plan: "free",
		planExpiresAt: null,
		period: "2026-10",
		projects: { used: 1, max: 3 },
		mockRequests: { used: 10, max: 10_000 },
		proxyRequests: { used: 0, max: 5_000 },
		...overrides,
	};
}

/** `/account` for `user`, with the usage of the user's plan by default. */
export function renderAccount(
	user: CurrentUser,
	routes: Record<string, MockRoute> = {},
	usageBody: unknown = usage({ plan: user.plan }),
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: user },
		"GET /api/v1/account/usage": { body: usageBody },
		...routes,
	});
	const view = renderRoutes(
		[{ path: "*", element: <AccountPage /> }],
		"/account",
	);
	return { ...api, ...view };
}

export function byId(id: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-id="${id}"]`);
}

/** Per-test setup of the trial tests: fresh session, frozen Saigon clock. */
export function setUpTrialTest(): void {
	resetCurrentUserCache();
	freezeTrialClock();
	// axe probes fonts through canvas, which jsdom lacks.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
}

export function tearDownTrialTest(): void {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
}
