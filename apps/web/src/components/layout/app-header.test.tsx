import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushSupport } from "../../platform/push-support";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { AppHeader } from "./app-header";

function renderHeader(
	user = makeUser(),
	extra: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
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
	screen.getByRole("button", { name: `Tài khoản ${name}` }).focus();
	await userEvent.keyboard("{Enter}");
}

describe("AppHeader", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the wordmark, bell, plan and account trigger", () => {
		const { container } = renderHeader(makeUser({ plan: "pro" }));
		expect(
			screen.getByRole("link", { name: "Localman, về Projects" }),
		).toHaveAttribute("href", "/projects");
		expect(screen.getByRole("button", { name: "Thông báo" })).toBeVisible();
		expect(
			container.querySelector('[data-id="topbar-plan"]'),
		).toHaveTextContent("Gói Pro");
	});

	it.each([
		["Email", "account-email"],
		["Mã khôi phục", "account-recovery"],
		["Mật khẩu và đăng nhập", "account-password"],
	])("opens the IdP section of '%s' in a new tab", async (label, hash) => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		renderHeader();
		await openAccountMenu("Minh Anh");
		await userEvent.click(
			await screen.findByRole("menuitem", {
				// jsdom puts a space before the sr-only suffix; browsers do not.
				name: new RegExp(`^${label} ?, mở trang tài khoản hoandat ở tab mới$`),
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
			"account-menu-plan",
			"account-menu-notifications",
			"account-menu-docs",
			"account-menu-email",
			"account-menu-recovery",
			"account-menu-idp",
			"topbar-logout",
		]);
		await userEvent.click(
			screen.getByRole("menuitem", { name: "Kênh thông báo" }),
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
			await screen.findByRole("menuitem", { name: "Đăng xuất" }),
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
			await screen.findByRole("menuitem", { name: "Đăng xuất" }),
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
			await screen.findByRole("menuitem", { name: "Đăng xuất" }),
		);
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		expect(unsubscribe).toHaveBeenCalled();
		expect(
			window.sessionStorage.getItem("localman-login-redirects"),
		).toBeNull();
	});

	it("falls back to the username and shows the plan in the menu", async () => {
		renderHeader(makeUser({ name: null }));
		await openAccountMenu("minhanh");
		const menu = await screen.findByRole("menu");
		expect(menu).toHaveTextContent("Gói Free");
		expect(menu).toHaveTextContent("minhanh@example.com");
	});

	it.each([
		["Quản trị · Quan tâm gói Pro", "/admin/pro-interest"],
		["Quản trị · Hộp thư góp ý", "/admin/feedback"],
	])("shows '%s' to the owner only", async (label, path) => {
		const { router } = renderHeader(makeUser({ isOwner: true }));
		await openAccountMenu("Minh Anh");
		await userEvent.click(await screen.findByRole("menuitem", { name: label }));
		expect(router.state.location.pathname).toBe(path);
	});

	it("hides the admin entry from other users and opens the plans modal", async () => {
		renderHeader();
		await openAccountMenu("Minh Anh");
		expect(
			await screen.findByRole("menuitem", { name: "Tài khoản và hạn mức" }),
		).toBeVisible();
		expect(screen.queryByRole("menuitem", { name: /^Quản trị/ })).toBeNull();
		await userEvent.click(
			screen.getByRole("menuitem", { name: "Quản lý gói" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Quản lý gói" }),
		).toBeInTheDocument();
	});
});
