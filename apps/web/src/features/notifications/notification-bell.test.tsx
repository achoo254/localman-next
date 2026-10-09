import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeNotification } from "../../test/fixtures";
import { type FetchCall, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { NotificationBell } from "./notification-bell";

const FIRST_PAGE = {
	items: [
		makeNotification("n1", { title: "Thu Trang nhận lời mời" }),
		makeNotification("n2", {
			title: "Đã dùng 84% request",
			link: "/projects/demo",
		}),
		makeNotification("n3", {
			title: "Đã đọc rồi",
			readAt: "2026-10-09T02:00:00.000Z",
		}),
	],
	nextCursor: "c2",
	unreadCount: 2,
};

const SECOND_PAGE = {
	items: [makeNotification("n4", { title: "Thông báo cũ", readAt: "x" })],
	nextCursor: null,
	unreadCount: 2,
};

function renderBell() {
	const api = mockFetch({
		"GET /api/v1/notifications": (call: FetchCall) => ({
			body: call.query.get("cursor") === "c2" ? SECOND_PAGE : FIRST_PAGE,
		}),
		"POST /api/v1/notifications/n1/read": { status: 204 },
		"POST /api/v1/notifications/n2/read": { status: 204 },
		"POST /api/v1/notifications/read-all": { status: 204 },
	});
	const view = renderRoutes(
		[{ path: "*", element: <NotificationBell /> }],
		"/projects",
	);
	return { ...api, ...view };
}

async function openBell(name: string) {
	const trigger = await screen.findByRole("button", { name });
	trigger.focus();
	await userEvent.keyboard("{Enter}");
	// Radix labels the menu by its trigger.
	return screen.findByRole("menu", { name });
}

describe("NotificationBell", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("shows the unread count as a badge and in the accessible name", async () => {
		const { container } = renderBell();
		await screen.findByRole("button", { name: "Thông báo, 2 chưa đọc" });
		expect(
			container.querySelector('[data-id="topbar-bell-count"]'),
		).toHaveTextContent("2");
	});

	// While the menu is open Radix hides the rest of the page from the
	// accessibility tree, so the trigger is checked through its data-id.
	it("marks an item read when chosen and keeps the menu open", async () => {
		const { calls, container } = renderBell();
		const menu = await openBell("Thông báo, 2 chưa đọc");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: /Thu Trang nhận lời mời/ }),
		);
		const bell = container.querySelector('[data-id="topbar-bell"]');
		await waitFor(() =>
			expect(bell).toHaveAccessibleName("Thông báo, 1 chưa đọc"),
		);
		expect(calls.map((c) => `${c.method} ${c.path}`)).toContain(
			"POST /api/v1/notifications/n1/read",
		);
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});

	it("follows an in-app link after marking it read", async () => {
		const { router } = renderBell();
		const menu = await openBell("Thông báo, 2 chưa đọc");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: /Đã dùng 84% request/ }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/projects/demo"),
		);
	});

	it("marks everything read and hides the badge", async () => {
		const { container, calls } = renderBell();
		const menu = await openBell("Thông báo, 2 chưa đọc");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Đánh dấu tất cả đã đọc" }),
		);
		const bell = container.querySelector('[data-id="topbar-bell"]');
		await waitFor(() => expect(bell).toHaveAccessibleName("Thông báo"));
		expect(container.querySelector('[data-id="topbar-bell-count"]')).toBeNull();
		expect(calls.some((c) => c.path === "/api/v1/notifications/read-all")).toBe(
			true,
		);
	});

	it("loads the next page with the cursor", async () => {
		const { calls } = renderBell();
		const menu = await openBell("Thông báo, 2 chưa đọc");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Xem thêm" }),
		);
		expect(
			await within(menu).findByRole("menuitem", { name: /Thông báo cũ/ }),
		).toBeInTheDocument();
		expect(calls.at(-1)?.query.get("cursor")).toBe("c2");
		expect(
			within(menu).queryByRole("menuitem", { name: "Xem thêm" }),
		).toBeNull();
	});
});
