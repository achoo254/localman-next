import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MockReply, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import type { NotificationChannels } from "./notification-preferences-api";
import { onNotificationsChanged } from "./notifications-changed";
import { TestNotificationPanel } from "./test-notification-panel";

const READY: NotificationChannels = {
	webPush: { available: true, enabled: true },
	telegram: {
		available: true,
		linked: true,
		activated: true,
		botUsername: "localman_bot",
	},
};

const SEND = { name: "Send test notification" };

function renderPanel(
	reply: MockReply | (() => Promise<MockReply>),
	channels: NotificationChannels = READY,
) {
	const onTelegramActivated = vi.fn();
	const api = mockFetch({
		"POST /api/v1/notifications/test":
			typeof reply === "function" ? () => reply() : reply,
	});
	renderRoutes(
		[
			{
				path: "*",
				element: (
					<TestNotificationPanel
						channels={channels}
						onTelegramActivated={onTelegramActivated}
					/>
				),
			},
		],
		"/account/notifications",
	);
	return { ...api, onTelegramActivated };
}

function row(channel: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(
		`[data-id="notify-test-${channel}"]`,
	);
	if (!element) throw new Error(`no result row for ${channel}`);
	return element;
}

describe("TestNotificationPanel", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows a loading state, then the outcome per channel, and refreshes the bell", async () => {
		let answer: (reply: MockReply) => void = () => {};
		const held = new Promise<MockReply>((resolve) => {
			answer = resolve;
		});
		const changed = vi.fn();
		const stop = onNotificationsChanged(changed);
		const { calls, onTelegramActivated } = renderPanel(() => held);

		await userEvent.click(screen.getByRole("button", SEND));
		const busy = await screen.findByRole("button", { name: "Sending…" });
		expect(busy).toBeDisabled();
		expect(calls.some((c) => c.method === "POST")).toBe(true);

		answer({ body: { inApp: "sent", webPush: "sent", telegram: "sent" } });
		await screen.findByText("Test notification results");
		expect(within(row("inApp")).getByText("Sent")).toBeInTheDocument();
		expect(row("inApp")).toHaveTextContent("Open the bell at the top");
		expect(within(row("webPush")).getByText("Sent")).toBeInTheDocument();
		expect(within(row("telegram")).getByText("Sent")).toBeInTheDocument();
		expect(screen.getByRole("button", SEND)).toBeEnabled();
		expect(changed).toHaveBeenCalledTimes(1);
		expect(onTelegramActivated).toHaveBeenCalledWith(true);
		stop();
	});

	it("tells apart channels not set up, not on the server and failed", async () => {
		renderPanel(
			{ body: { inApp: "sent", webPush: "failed", telegram: "skipped" } },
			{
				webPush: { available: true, enabled: true },
				telegram: { ...READY.telegram, available: false, linked: false },
			},
		);
		await userEvent.click(screen.getByRole("button", SEND));
		await screen.findByText("Test notification results");
		expect(within(row("webPush")).getByText("Failed")).toBeInTheDocument();
		expect(row("webPush")).toHaveTextContent("Couldn't deliver it");
		expect(
			within(row("telegram")).getByText("Not on this server"),
		).toBeInTheDocument();
	});

	it("shows a skipped Web Push on a ready server as not set up", async () => {
		renderPanel({
			body: { inApp: "sent", webPush: "skipped", telegram: "sent" },
		});
		await userEvent.click(screen.getByRole("button", SEND));
		await screen.findByText("Test notification results");
		expect(within(row("webPush")).getByText("Not set up")).toBeInTheDocument();
	});

	it("asks to press Start in the bot when Telegram refused the message", async () => {
		const { onTelegramActivated } = renderPanel({
			body: { inApp: "sent", webPush: "skipped", telegram: "blocked" },
		});
		await userEvent.click(screen.getByRole("button", SEND));
		await screen.findByText("Test notification results");
		const telegram = row("telegram");
		expect(within(telegram).getByText("Bot not started")).toBeInTheDocument();
		expect(telegram).toHaveTextContent(
			"Open @localman_bot and press Start, then send another test.",
		);
		expect(
			within(telegram).getByRole("link", { name: "@localman_bot" }),
		).toHaveAttribute("href", "https://t.me/localman_bot");
		expect(onTelegramActivated).toHaveBeenCalledWith(false);
	});

	it("shows a skipped linked chat (relink pending) as not set up", async () => {
		const { onTelegramActivated } = renderPanel(
			{ body: { inApp: "sent", webPush: "sent", telegram: "skipped" } },
			{ ...READY, telegram: { ...READY.telegram, activated: false } },
		);
		await userEvent.click(screen.getByRole("button", SEND));
		await screen.findByText("Test notification results");
		expect(within(row("telegram")).getByText("Not set up")).toBeInTheDocument();
		expect(onTelegramActivated).not.toHaveBeenCalled();
	});

	it("explains the rate limit and lets the user try again", async () => {
		const changed = vi.fn();
		const stop = onNotificationsChanged(changed);
		renderPanel({
			status: 429,
			body: { error: { code: "RATE_LIMITED", message: "slow down" } },
		});
		await userEvent.click(screen.getByRole("button", SEND));
		expect(
			await screen.findByText(
				"You sent a test less than a minute ago. Wait a minute and try again.",
			),
		).toBeInTheDocument();
		expect(screen.getByRole("button", SEND)).toBeEnabled();
		expect(changed).not.toHaveBeenCalled();
		stop();
	});

	it("shows other API errors as the API wrote them", async () => {
		renderPanel({
			status: 500,
			body: { error: { code: "INTERNAL_ERROR", message: "Server broke" } },
		});
		await userEvent.click(screen.getByRole("button", SEND));
		expect(await screen.findByText("Server broke")).toBeInTheDocument();
	});
});
