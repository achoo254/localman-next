import { act, screen, waitFor } from "@testing-library/react";
import { type Root, hydrateRoot } from "react-dom/client";
// `react-router/dom` adds only flushSync around this provider (no extra
// markup); vitest loads it as a second copy of the router context, so the
// test uses the core provider like the other route tests.
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "./app-providers";
import { resetCurrentUserCache } from "./features/auth/use-current-user";
import { renderPageHtml } from "./prerender";
import { routes } from "./routes";
import { makeUser } from "./test/fixtures";
import { type MockRoute, UNAUTHENTICATED, mockFetch } from "./test/mock-fetch";
import { createTestQueryClient } from "./test/render-app";

let root: Root | null = null;

/** Prerenders `page`, then hydrates it at `path` the way main.tsx does. */
async function hydrateLanding(me: MockRoute, path = "/", page = "/") {
	const html = await renderPageHtml(page);
	mockFetch({
		"GET /api/v1/users/me": me,
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
		"GET /api/v1/projects": { body: { items: [] } },
	});
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.append(container);
	const recoverable: unknown[] = [];
	const router = createMemoryRouter(routes, { initialEntries: [path] });
	await act(async () => {
		root = hydrateRoot(
			container,
			<AppProviders queryClient={createTestQueryClient()}>
				<RouterProvider router={router} />
			</AppProviders>,
			{ onRecoverableError: (error) => recoverable.push(error) },
		);
	});
	return { html, container, recoverable, router };
}

describe("landing prerender", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});
	afterEach(() => {
		act(() => root?.unmount());
		root = null;
		document.body.replaceChildren();
		window.localStorage.clear();
		document.documentElement.lang = "en";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("renders the whole landing for an anonymous visitor, flags off", async () => {
		const html = await renderPageHtml("/");
		for (const id of [
			"public-sign-in",
			"hero",
			"sign-in-cta",
			"landing-relations",
			"public-footer",
			"theme-switch",
		]) {
			expect(html).toContain(`data-id="${id}"`);
		}
		expect(html).not.toContain('data-id="landing-live-sync"');
		expect(html).not.toContain("Loading");
	});

	it("hydrates without a mismatch or console error", async () => {
		const consoleError = vi.spyOn(console, "error");
		const { recoverable } = await hydrateLanding(UNAUTHENTICATED);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { level: 1, name: /REST API/ }),
			).toBeInTheDocument(),
		);
		expect(recoverable).toEqual([]);
		// Server and client renderers share context objects in this one test
		// process (never in a browser), which React reports; anything else fails.
		const errors = consoleError.mock.calls
			.map((args) => args.map(String).join(" "))
			.filter((text) => !text.includes("multiple renderers concurrently"));
		expect(errors).toEqual([]);
	});

	it("is written in English", async () => {
		const html = await renderPageHtml("/");
		expect(html).toContain("REST APIs with relations and Faker");
		expect(html).toContain("Sign in with hoandat.com");
		expect(html).not.toMatch(/Đăng nhập bằng|使用 hoandat\.com 登录/);
	});

	it("hydrates in English, then switches to the saved language without a mismatch", async () => {
		window.localStorage.setItem("localman-locale", "vi");
		const consoleError = vi.spyOn(console, "error");
		const { html, recoverable } = await hydrateLanding(UNAUTHENTICATED);
		expect(html).toContain("REST APIs with relations and Faker");
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { level: 1, name: /có trạng thái/ }),
			).toBeInTheDocument(),
		);
		expect(document.documentElement.lang).toBe("vi");
		expect(recoverable).toEqual([]);
		const errors = consoleError.mock.calls
			.map((args) => args.map(String).join(" "))
			.filter((text) => !text.includes("multiple renderers concurrently"));
		expect(errors).toEqual([]);
	});

	it("shows an auth error from the query string once hydrated", async () => {
		const { recoverable } = await hydrateLanding(
			UNAUTHENTICATED,
			"/?authError=login_expired",
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Your sign-in expired",
		);
		expect(recoverable).toEqual([]);
	});

	it("keeps a signed-in visitor on the landing and offers Open app", async () => {
		const { router, recoverable } = await hydrateLanding({ body: makeUser() });
		const openApp = await screen.findAllByRole("link", { name: "Open app" });
		expect(openApp.map((link) => link.getAttribute("data-id"))).toEqual([
			"topbar-projects",
		]);
		expect(router.state.location.pathname).toBe("/");
		expect(recoverable).toEqual([]);
	});
});
