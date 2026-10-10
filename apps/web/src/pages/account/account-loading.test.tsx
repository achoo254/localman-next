import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { NotificationBell } from "../../features/notifications/notification-bell";
import { seriousViolations } from "../../test/axe";
import { makeNotification, makeUser } from "../../test/fixtures";
import { type MockReply, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { findToast } from "../../test/toast";
import { AccountPage } from "./account-page";

/** A route whose answers wait until the test releases them. */
function held() {
	const pending: Array<(reply: MockReply) => void> = [];
	return {
		route: () =>
			new Promise<MockReply>((resolve) => {
				pending.push(resolve);
			}),
		release: (reply: MockReply) => {
			for (const resolve of pending.splice(0)) resolve(reply);
		},
	};
}

const USAGE = {
	plan: "free",
	planExpiresAt: null,
	period: "2026-12",
	projects: { used: 1, max: 3 },
	mockRequests: { used: 20, max: 10_000 },
	proxyRequests: { used: 0, max: 5_000 },
};

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("Account loading states", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows meter-shaped skeletons on a slow usage load, announced once", async () => {
		const usage = held();
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/account/usage": usage.route,
		});
		const { container } = renderRoutes(
			[{ path: "*", element: <AccountPage /> }],
			"/account",
		);
		expect(byId("account-meters-loading")).toBeNull();
		await waitFor(() => expect(byId("account-meters-loading")).not.toBeNull());
		expect(byId("account-meters-loading")).toHaveAttribute("aria-busy", "true");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading quotas…"),
		);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => usage.release({ body: USAGE }));
		expect(
			await screen.findByRole("meter", { name: "Mock requests this month" }),
		).toBeVisible();
		expect(byId("account-meters-loading")).toBeNull();
	});

	it("marks all notifications read at once and restores them when refused", async () => {
		const readAll = held();
		mockFetch({
			"GET /api/v1/notifications": {
				body: {
					items: [makeNotification("n1", { title: "Invited to Shop" })],
					nextCursor: null,
					unreadCount: 1,
				},
			},
			"POST /api/v1/notifications/read-all": readAll.route,
		});
		const { container } = renderRoutes(
			[{ path: "*", element: <NotificationBell /> }],
			"/projects",
		);
		const trigger = await screen.findByRole("button", {
			name: "Notifications, 1 unread",
		});
		trigger.focus();
		await userEvent.keyboard("{Enter}");
		const menu = await screen.findByRole("menu", {
			name: "Notifications, 1 unread",
		});
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Mark all as read" }),
		);
		const count = () =>
			container.querySelector('[data-id="topbar-bell-count"]');
		await waitFor(() => expect(count()).toBeNull());
		await act(async () =>
			readAll.release({
				status: 500,
				body: { error: { code: "INTERNAL", message: "Inbox unavailable" } },
			}),
		);
		await waitFor(() => expect(count()).toHaveTextContent("1"));
		expect(await findToast("Inbox unavailable")).toBeInTheDocument();
	});

	it("draws skeleton rows in the bell menu while the first page is slow", async () => {
		const list = held();
		mockFetch({ "GET /api/v1/notifications": list.route });
		renderRoutes([{ path: "*", element: <NotificationBell /> }], "/projects");
		const trigger = await screen.findByRole("button", {
			name: "Notifications",
		});
		trigger.focus();
		await userEvent.keyboard("{Enter}");
		const menu = await screen.findByRole("menu", { name: "Notifications" });
		// Screen readers hear "Loading…" in the menu right away.
		expect(within(menu).getByText("Loading…")).toHaveClass("sr-only");
		await waitFor(() => expect(byId("notifications-loading")).not.toBeNull());
		await act(async () =>
			list.release({
				body: {
					items: [makeNotification("n1", { title: "Invited to Shop" })],
					nextCursor: null,
					unreadCount: 1,
				},
			}),
		);
		expect(await within(menu).findByText("Invited to Shop")).toBeVisible();
		expect(byId("notifications-loading")).toBeNull();
	});
});
