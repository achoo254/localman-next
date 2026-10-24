import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushSupport } from "../../platform/push-support";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { AppHeader } from "./app-header";

const TENANT = {
	displayName: "hoandat",
	idpOrigin: "https://auth.hoandat.com",
	publicUrl: "https://localman.hoandat.com",
	mockBaseDomain: "localman.hoandat.com",
	tunnelDomain: "tunnel.hoandat.com",
};

function renderHeader(
	user = makeUser(),
	extra: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		"GET /api/v1/tenant": { body: TENANT },
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
		...extra,
	});
	const view = renderRoutes(
		[{ path: "*", element: <AppHeader user={user} /> }],
		"/projects",
	);
	return { ...api, ...view };
}

function spyOnSubmit() {
	return vi
		.spyOn(HTMLFormElement.prototype, "submit")
		.mockImplementation(() => undefined);
}

async function openAccountMenu(name: string) {
	screen.getByRole("button", { name: `${name} · Account` }).focus();
	await userEvent.keyboard("{Enter}");
}

describe("AppHeader", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the wordmark, bell and account trigger, and no plan", () => {
		const { container } = renderHeader(makeUser({ plan: "pro" }));
		expect(
			screen.getByRole("link", { name: "Localman, go to Projects" }),
		).toHaveAttribute("href", "/projects");
		expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
		expect(container.querySelector('[data-id="topbar-plan"]')).toBeNull();
		expect(container).not.toHaveTextContent(/plan/i);
	});

	it("puts the app switcher between the bell and the account trigger", async () => {
		renderHeader();
		const bell = screen.getByRole("button", { name: "Notifications" });
		const switcher = await screen.findByRole("button", { name: "Switch app" });
		const account = screen.getByRole("button", { name: "Minh Anh · Account" });
		expect(
			bell.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			switcher.compareDocumentPosition(account) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it.each([
		["Email", "account-email"],
		["Sign-in methods", "account-sign-in"],
	])("opens the IdP section of '%s' in a new tab", async (label, hash) => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		renderHeader();
		await openAccountMenu("Minh Anh");
		await userEvent.click(
			await screen.findByRole("menuitem", {
				// jsdom puts a space before the sr-only suffix; browsers do not.
				name: new RegExp(
					`^${label} ?, opens your hoandat account in a new tab$`,
				),
			}),
		);
		expect(open).toHaveBeenCalledWith(
			`https://auth.hoandat.com/account#${hash}`,
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("lists the in-app entries in order and links Docs", async () => {
		const { router } = renderHeader();
		expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
			"href",
			"/docs",
		);
		await openAccountMenu("Minh Anh");
		const items = (await screen.findAllByRole("menuitem")).map(
			(item) => item.getAttribute("data-id") ?? "",
		);
		expect(items).toEqual([
			"account-menu-account",
			"account-menu-notifications",
			"account-menu-docs",
			"account-menu-home",
			"account-menu-feedback",
			"account-menu-email",
			"account-menu-idp",
			"topbar-logout",
		]);
		await userEvent.click(
			screen.getByRole("menuitem", { name: "Notification channels" }),
		);
		expect(router.state.location.pathname).toBe("/account/notifications");
	});

	it("logs out with a form POST to /auth/logout", async () => {
		const submit = spyOnSubmit();
		const { container, calls } = renderHeader();
		const form = container.querySelector('[data-id="topbar-logout-form"]');
		expect(form).toHaveAttribute("method", "post");
		expect(form).toHaveAttribute("action", "/auth/logout");
		await openAccountMenu("Minh Anh");
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Sign out" }),
		);
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		expect(calls.some((c) => c.method === "DELETE")).toBe(false);
	});

	it("drops this browser's push subscription before logging out", async () => {
		const submit = spyOnSubmit();
		vi.spyOn(pushSupport, "currentEndpoint").mockResolvedValue(
			"https://push.example/sub-1",
		);
		const unsubscribe = vi
			.spyOn(pushSupport, "unsubscribe")
			.mockResolvedValue(undefined);
		const { calls } = renderHeader(makeUser(), {
			"DELETE /api/v1/push-subscriptions": { status: 204 },
		});
		await openAccountMenu("Minh Anh");
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Sign out" }),
		);
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		const del = calls.find((c) => c.method === "DELETE");
		expect(del?.body).toEqual({ endpoint: "https://push.example/sub-1" });
		expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
			submit.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("still logs out when the push cleanup fails", async () => {
		const submit = spyOnSubmit();
		vi.spyOn(pushSupport, "currentEndpoint").mockResolvedValue(
			"https://push.example/sub-1",
		);
		const unsubscribe = vi
			.spyOn(pushSupport, "unsubscribe")
			.mockRejectedValue(new Error("gone"));
		renderHeader(makeUser(), {
			"DELETE /api/v1/push-subscriptions": {
				status: 401,
				body: { error: { code: "UNAUTHENTICATED", message: "Hết phiên." } },
			},
		});
		await openAccountMenu("Minh Anh");
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Sign out" }),
		);
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		expect(unsubscribe).toHaveBeenCalled();
		expect(
			window.sessionStorage.getItem("localman-login-redirects"),
		).toBeNull();
	});

	it("falls back to the username and names no plan in the menu", async () => {
		renderHeader(makeUser({ name: null }));
		await openAccountMenu("minhanh");
		const menu = await screen.findByRole("menu");
		expect(menu).not.toHaveTextContent(/plan|pricing/i);
		expect(menu).toHaveTextContent("minhanh@example.com");
	});

	it.each([
		["Admin · Pro interest", "/admin/pro-interest"],
		["Admin · Feedback inbox", "/admin/feedback"],
	])("shows '%s' to the owner only", async (label, path) => {
		const { router } = renderHeader(makeUser({ isOwner: true }));
		await openAccountMenu("Minh Anh");
		await userEvent.click(await screen.findByRole("menuitem", { name: label }));
		expect(router.state.location.pathname).toBe(path);
	});

	it("hides the admin entry from other users", async () => {
		renderHeader();
		await openAccountMenu("Minh Anh");
		expect(
			await screen.findByRole("menuitem", { name: "Account and limits" }),
		).toBeVisible();
		expect(screen.queryByRole("menuitem", { name: /^Admin/ })).toBeNull();
	});
});
