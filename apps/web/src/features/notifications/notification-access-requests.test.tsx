import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { makeNotification } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { findToast } from "../../test/toast";
import { NotificationBell } from "./notification-bell";
import type { AppNotification } from "./notifications-api";

const REQUEST = "/api/v1/access-requests/r1";
const VIEW = {
	id: "r1",
	element: { type: "collection", id: "c1", name: "Orders API" },
	requester: { username: "lan", name: "Lan", picture: null },
	role: "viewer",
	message: null,
	createdAt: "2026-10-10T01:00:00.000Z",
};

type Role = "viewer" | "editor";

/** The notification announced `notifiedRole`; the request asks `role` now. */
function requested(
	status: "pending" | "approved" | "denied",
	role: Role = "viewer",
	notifiedRole: Role = role,
): AppNotification {
	return makeNotification("n1", {
		type: "access.requested",
		title: "Lan asks for access to Orders API",
		link: "/access-requests/r1",
		accessRequest: { id: "r1", status, role, notifiedRole },
	});
}

const SHARED = makeNotification("n2", {
	type: "element.shared",
	title: "Hoa shared Orders API with you",
});
const OTHER = makeNotification("n3", { title: "84% of requests used" });

function renderBell(
	items: () => AppNotification[],
	routes: Record<string, MockRoute> = {},
	workspaces = true,
) {
	const api = mockFetch({
		"GET /api/v1/notifications": () => ({
			body: { items: items(), nextCursor: null, unreadCount: 1 },
		}),
		...routes,
	});
	renderRoutes(
		[
			{
				path: "*",
				element: (
					<FeaturesContext
						value={{ ...NO_FEATURES, apiClient: true, workspaces }}
					>
						<NotificationBell />
					</FeaturesContext>
				),
			},
		],
		"/api-client",
	);
	return api;
}

async function openBell() {
	const trigger = await screen.findByRole("button", {
		name: /^Notifications/,
	});
	trigger.focus();
	await userEvent.keyboard("{Enter}");
	return screen.findByRole("menu");
}

describe("access requests in the bell", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("approves the role the notification announced and keeps focus in the menu", async () => {
		let status: "pending" | "approved" = "pending";
		const { calls } = renderBell(() => [requested(status)], {
			[`POST ${REQUEST}/approve`]: () => {
				status = "approved";
				return { body: { ...VIEW, status: "approved" } };
			},
		});
		const menu = await openBell();
		const approve = await within(menu).findByRole("menuitem", {
			name: "Approve as Viewer",
		});
		expect(approve).toHaveAttribute("data-id", "notifications-approve");
		expect(
			within(menu).getByRole("menuitem", { name: "Deny" }),
		).toHaveAttribute("data-id", "notifications-deny");
		await userEvent.click(approve);
		expect(await findToast("Approved the request from Lan")).toBeVisible();
		expect(calls.find((c) => c.path.endsWith("/approve"))?.body).toEqual({
			role: "viewer",
		});
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="notifications-access-status"]'),
			).toHaveTextContent("Approved"),
		);
		expect(
			within(menu).queryByRole("menuitem", { name: /^Approve/ }),
		).toBeNull();
		// Focus stays on the notification, not lost to <body>.
		expect(document.activeElement).toHaveAttribute(
			"data-id",
			"notifications-item-n1",
		);
	});

	it("never approves an upgrade the approver has not read", async () => {
		// Asked for Viewer (this notification), then upgraded to Editor.
		const { calls } = renderBell(
			() => [requested("pending", "editor", "viewer")],
			{
				[`POST ${REQUEST}/approve`]: {
					status: 409,
					body: { error: { code: "REQUEST_CHANGED", message: "changed" } },
				},
			},
		);
		const menu = await openBell();
		await userEvent.click(
			await within(menu).findByRole("menuitem", { name: "Approve as Viewer" }),
		);
		expect(
			await findToast("The request changed. Open the newer notification."),
		).toBeVisible();
		expect(calls.find((c) => c.path.endsWith("/approve"))?.body).toEqual({
			role: "viewer",
		});
		await waitFor(() =>
			expect(
				calls.filter((c) => c.path === "/api/v1/notifications").length,
			).toBeGreaterThanOrEqual(3),
		);
	});

	it("denies a request and toasts a refusal from the API", async () => {
		renderBell(() => [requested("pending")], {
			[`POST ${REQUEST}/deny`]: {
				status: 409,
				body: { error: { code: "ALREADY_RESOLVED", message: "done" } },
			},
		});
		const menu = await openBell();
		await userEvent.click(
			await within(menu).findByRole("menuitem", { name: "Deny" }),
		);
		expect(
			await findToast("Someone already handled this request."),
		).toBeVisible();
	});

	it("labels handled requests instead of offering actions", async () => {
		renderBell(() => [requested("denied")]);
		const menu = await openBell();
		expect(await within(menu).findByText("Declined")).toBeInTheDocument();
		expect(within(menu).queryByRole("menuitem", { name: "Deny" })).toBeNull();
	});

	it("leaves sharing notifications out while the workspaces flag is off", async () => {
		renderBell(() => [requested("pending"), SHARED, OTHER], {}, false);
		const menu = await openBell();
		await within(menu).findByText("84% of requests used");
		expect(
			within(menu).queryByText("Lan asks for access to Orders API"),
		).toBeNull();
		expect(
			within(menu).queryByText("Hoa shared Orders API with you"),
		).toBeNull();
		expect(
			within(menu).queryByRole("menuitem", { name: /^Approve/ }),
		).toBeNull();
	});
});
