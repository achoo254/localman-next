import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushSupport } from "../../platform/push-support";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { resetCurrentUserCache } from "../auth/use-current-user";
import type { NotificationPreferences } from "./notification-preferences-api";
import { NotificationSettingsPage } from "./notification-settings-page";

function prefs(
	telegram: Partial<NotificationPreferences["channels"]["telegram"]> = {},
): NotificationPreferences {
	return {
		channels: {
			webPush: { available: true, enabled: false },
			telegram: {
				available: true,
				linked: false,
				activated: false,
				botUsername: "localman_bot",
				...telegram,
			},
		},
		events: [
			{
				type: "member.joined",
				label: "Member joined",
				inApp: true,
				webPush: false,
				telegram: false,
			},
		],
	};
}

const SAVE = { name: "Save preferences" };

const SUBSCRIPTION = {
	endpoint: "https://push.example/sub-1",
	keys: { p256dh: "key", auth: "secret" },
};

function renderPage(
	preferences: NotificationPreferences,
	extra: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": {
			body: makeUser({ telegram: { linked: true, username: "minhanh" } }),
		},
		"GET /api/v1/notification-preferences": { body: preferences },
		...extra,
	});
	renderRoutes(
		[{ path: "*", element: <NotificationSettingsPage /> }],
		"/account/notifications",
	);
	return api;
}

function mockBrowserPush(endpoint: string | null) {
	vi.spyOn(pushSupport, "isSupported").mockReturnValue(true);
	vi.spyOn(pushSupport, "permission").mockReturnValue("default");
	vi.spyOn(pushSupport, "currentEndpoint").mockResolvedValue(endpoint);
}

describe("NotificationSettingsPage", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("links Telegram through the IdP account page when not linked", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		renderPage(prefs());
		const link = await screen.findByRole("link", { name: "Link Telegram" });
		expect(link).toHaveAttribute("href", "https://auth.hoandat.com/account");
		await userEvent.click(link);
		expect(open).toHaveBeenCalledWith(
			"https://auth.hoandat.com/account",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("asks to press Start in the bot when linked but not activated", async () => {
		renderPage(prefs({ linked: true }));
		expect(
			await screen.findByText("Linked as @minhanh, bot not started yet."),
		).toBeInTheDocument();
		const bot = screen.getByRole("link", { name: "@localman_bot" });
		expect(bot).toHaveAttribute("href", "https://t.me/localman_bot");
		expect(bot.closest('[data-id="notify-telegram-start"]')).toHaveTextContent(
			"Open @localman_bot and press Start",
		);
	});

	it("hides the reminder once the bot is activated", async () => {
		renderPage(prefs({ linked: true, activated: true }));
		expect(await screen.findByText("Linked as @minhanh.")).toBeInTheDocument();
		expect(screen.queryByText(/press Start/)).toBeNull();
		expect(screen.getByRole("link", { name: "Manage" })).toBeVisible();
	});

	it("disables Web Push in browsers without support", async () => {
		renderPage(prefs());
		expect(
			await screen.findByText("This browser doesn't support Web Push."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Turn on Web Push" }),
		).toBeDisabled();
	});

	it("subscribes this browser and sends the subscription", async () => {
		mockBrowserPush(null);
		const subscribe = vi
			.spyOn(pushSupport, "subscribe")
			.mockResolvedValue(SUBSCRIPTION);
		const { calls } = renderPage(prefs(), {
			"GET /api/v1/push/vapid-public-key": { body: { publicKey: "BPub" } },
			"POST /api/v1/push-subscriptions": { status: 201, body: { ok: true } },
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Turn on Web Push" }),
		);
		expect(await screen.findByText("On in this browser.")).toBeInTheDocument();
		expect(subscribe).toHaveBeenCalledWith("BPub");
		const post = calls.find((c) => c.path === "/api/v1/push-subscriptions");
		expect(post?.body).toEqual(SUBSCRIPTION);
	});

	it("unsubscribes and deletes the subscription by endpoint", async () => {
		mockBrowserPush(SUBSCRIPTION.endpoint);
		const unsubscribe = vi
			.spyOn(pushSupport, "unsubscribe")
			.mockResolvedValue(undefined);
		const { calls } = renderPage(prefs(), {
			"DELETE /api/v1/push-subscriptions": { status: 204 },
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Turn off Web Push" }),
		);
		await screen.findByText("Off.");
		expect(unsubscribe).toHaveBeenCalled();
		const del = calls.find((c) => c.method === "DELETE");
		expect(del?.body).toEqual({ endpoint: SUBSCRIPTION.endpoint });
	});

	it("lets the user mute in-app notifications per event", async () => {
		const { calls } = renderPage(prefs(), {
			"PUT /api/v1/notification-preferences": { body: prefs() },
		});
		const inApp = await screen.findByRole("checkbox", {
			name: "Member joined: In app",
		});
		expect(inApp).toBeEnabled();
		await userEvent.click(inApp);
		await userEvent.click(screen.getByRole("button", SAVE));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
				events: [
					{
						type: "member.joined",
						inApp: false,
						webPush: false,
						telegram: false,
					},
				],
			}),
		);
	});

	it("saves per-event choices with one PUT", async () => {
		const saved = prefs();
		const { calls } = renderPage(prefs(), {
			"PUT /api/v1/notification-preferences": { body: saved },
		});
		const save = await screen.findByRole("button", SAVE);
		expect(save).toBeDisabled();
		expect(
			screen.getByRole("checkbox", { name: "Member joined: Telegram" }),
		).toBeDisabled();
		await userEvent.click(
			screen.getByRole("checkbox", { name: "Member joined: Web Push" }),
		);
		await userEvent.click(save);
		await waitFor(() =>
			expect(calls.some((c) => c.method === "PUT")).toBe(true),
		);
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			events: [
				{ type: "member.joined", inApp: true, webPush: true, telegram: false },
			],
		});
	});
});
