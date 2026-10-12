import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { unreleasedMentions } from "../../test/unreleased-copy";
import { AccountPage } from "../account/account-page";
import { LandingPage } from "./landing-page";
import { renderWithFeatures } from "./landing-test-helpers";

describe("no unreleased feature in the copy while every flag is off", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});

	it("landing, Webhook only on its 'Coming soon' card", () => {
		const { container } = renderWithFeatures(<LandingPage />, NO_FEATURES);
		expect(unreleasedMentions(container)).toEqual([]);
		const webhook = container.querySelector('[data-id="feature-webhooks"]');
		expect(webhook).toHaveTextContent("Coming soon");
	});

	it("account page with its meters", async () => {
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/account/usage": {
				body: {
					plan: "free",
					planExpiresAt: null,
					period: "2026-12",
					projects: { used: 1, max: 3 },
					mockRequests: { used: 10, max: 10_000 },
					proxyRequests: { used: 0, max: 5_000 },
				},
			},
		});
		const { container } = renderWithFeatures(<AccountPage />, NO_FEATURES);
		await screen.findByRole("meter", { name: "Mock requests this month" });
		expect(unreleasedMentions(container)).toEqual([]);
	});
});
