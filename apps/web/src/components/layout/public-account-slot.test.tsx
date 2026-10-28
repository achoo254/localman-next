import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	peekCurrentUser,
	resetCurrentUserCache,
} from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import { makeUser } from "../../test/fixtures";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

type SessionCase = "loading" | "anonymous" | "authenticated";

const ME: Record<SessionCase, MockRoute> = {
	loading: () => new Promise<never>(() => undefined),
	anonymous: UNAUTHENTICATED,
	authenticated: { body: makeUser() },
};

function topbar(): HTMLElement {
	const bar = document.querySelector('header[data-id="public-header"]');
	if (!(bar instanceof HTMLElement)) throw new Error("no top bar");
	return bar;
}

/** Renders `path` with the session in `state` and waits until it is reached. */
async function renderPublic(state: SessionCase, path = "/"): Promise<void> {
	mockFetch({
		"GET /api/v1/users/me": ME[state],
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
	});
	renderRoutes(routes, path);
	await screen.findByRole("heading", { level: 1 });
	await waitFor(() => expect(peekCurrentUser().status).toBe(state));
	if (state === "authenticated") {
		await waitFor(() =>
			expect(
				topbar().querySelector('[data-id="topbar-account-slot"]'),
			).not.toBeNull(),
		);
	}
}

describe("account slot of the shared public header", () => {
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

	it.each<SessionCase>(["loading", "anonymous"])(
		"offers the one Sign in, to the sign-in page, while %s",
		async (state) => {
			await renderPublic(state);
			const bar = within(topbar());
			expect(bar.getByRole("link", { name: "Sign in" })).toHaveAttribute(
				"href",
				"/login",
			);
			expect(bar.queryByRole("link", { name: /Get started/ })).toBeNull();
			expect(bar.queryByRole("link", { name: "Open app" })).toBeNull();
		},
	);

	it("signs in from a docs page straight back to that page", async () => {
		await renderPublic("anonymous", "/docs/quick-start");
		expect(
			within(topbar()).getByRole("link", { name: "Sign in" }),
		).toHaveAttribute(
			"href",
			`/auth/login?returnTo=${encodeURIComponent("/docs/quick-start")}`,
		);
	});

	it("shows Open app and the avatar without the name once signed in", async () => {
		await renderPublic("authenticated");
		const bar = within(topbar());
		const account = bar.getByRole("button", { name: "Minh Anh · Account" });
		expect(account).not.toHaveTextContent("Minh Anh");
		expect(bar.getByRole("link", { name: "Open app" })).toHaveAttribute(
			"href",
			"/projects",
		);
		expect(bar.queryByRole("link", { name: "Sign in" })).toBeNull();
	});

	it.each<SessionCase>(["loading", "anonymous", "authenticated"])(
		"has no serious axe violations in the top bar while %s",
		async (state) => {
			await renderPublic(state);
			expect(await seriousViolations(topbar())).toEqual([]);
		},
	);
});
