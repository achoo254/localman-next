import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { makeUser } from "../../test/fixtures";
import {
	type MockReply,
	type MockRoute,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import type { NotificationPreferences } from "./notification-preferences-api";
import { NotificationSettingsPage } from "./notification-settings-page";

function prefs(): NotificationPreferences {
	return {
		channels: {
			webPush: { available: true, enabled: false },
			telegram: {
				available: true,
				linked: false,
				activated: false,
				botUsername: "localman_bot",
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

function renderPage(
	preferences: NotificationPreferences,
	extra: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/notification-preferences": { body: preferences },
		...extra,
	});
	return {
		...api,
		...renderRoutes(
			[{ path: "*", element: <NotificationSettingsPage /> }],
			"/account/notifications",
		),
	};
}

describe("NotificationSettingsPage loading and saving", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows the settings skeleton on a slow load, announced once", async () => {
		let answer: (reply: MockReply) => void = () => {};
		const { container } = renderPage(prefs(), {
			"GET /api/v1/notification-preferences": () =>
				new Promise<MockReply>((resolve) => {
					answer = resolve;
				}),
		});
		const region = await waitFor(() => {
			const found = document.querySelector(
				'[data-id="notify-settings-loading"]',
			);
			if (!found) throw new Error("no skeleton yet");
			return found;
		});
		expect(region).toHaveAttribute("aria-busy", "true");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading settings…"),
		);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => answer({ body: prefs() }));
		expect(
			await screen.findByRole("checkbox", { name: "Member joined: In app" }),
		).toBeChecked();
	});

	it("ticks a box back with an error toast when the save is refused", async () => {
		let answer: (reply: MockReply) => void = () => {};
		renderPage(prefs(), {
			"PUT /api/v1/notification-preferences": () =>
				new Promise<MockReply>((resolve) => {
					answer = resolve;
				}),
		});
		const webPush = await screen.findByRole("checkbox", {
			name: "Member joined: Web Push",
		});
		await userEvent.click(webPush);
		// Shown before the server answers, and the box stays usable.
		expect(webPush).toBeChecked();
		expect(webPush).toBeEnabled();
		await act(async () =>
			answer({
				status: 500,
				body: { error: { code: "INTERNAL", message: "Preferences locked" } },
			}),
		);
		await waitFor(() => expect(webPush).not.toBeChecked());
		expect(await findToast("Preferences locked")).toBeVisible();
	});
});
