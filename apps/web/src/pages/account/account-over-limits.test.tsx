import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { AccountPage } from "./account-page";

function renderAccount(overLimits: unknown[]) {
	mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/account/usage": {
			body: {
				plan: "free",
				planExpiresAt: null,
				period: "2026-10",
				projects: { used: 7, max: 3 },
				mockRequests: { used: 10, max: 10_000 },
				proxyRequests: { used: 0, max: 5_000 },
				overLimits,
			},
		},
	});
	renderRoutes([{ path: "*", element: <AccountPage /> }], "/account");
}

const banner = () =>
	document.querySelector<HTMLElement>('[data-id="account-over-limits"]');

describe("AccountPage above the account's limits", () => {
	beforeEach(resetCurrentUserCache);
	afterEach(() => vi.unstubAllGlobals());

	it("lists the limits the account is above, without naming a plan", async () => {
		renderAccount([
			{ limit: "projects", used: 7, max: 3 },
			{ limit: "resources", used: 49, max: 10 },
		]);
		await waitFor(() => expect(banner()).not.toBeNull());
		const alert = within(banner() ?? document.body);
		expect(
			alert.getByText(
				"You're above this account's limits: 7/3 projects, 49/10 resources.",
			),
		).toBeVisible();
		expect(
			alert.getByText(
				"Everything keeps working; creating more is blocked until you're under the limits.",
			),
		).toBeVisible();
		expect(banner()).not.toHaveTextContent(/free|plan|pro\b/i);
	});

	it("shows no banner within the limits", async () => {
		renderAccount([]);
		await screen.findByRole("meter", { name: "Projects" });
		expect(banner()).toBeNull();
	});
});
