import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trialUser } from "../../features/subscription/trial-test-helpers";
import {
	byId,
	renderAccount,
	setUpTrialTest,
	tearDownTrialTest,
	usage,
} from "./account-trial-test-helpers";

describe("AccountPage above the plan limits", () => {
	beforeEach(setUpTrialTest);
	afterEach(tearDownTrialTest);

	it("lists the Free limits the account is above", async () => {
		renderAccount(
			trialUser("used"),
			{},
			usage({
				projects: { used: 7, max: 3 },
				overLimits: [
					{ limit: "projects", used: 7, max: 3 },
					{ limit: "resources", used: 49, max: 10 },
				],
			}),
		);
		await waitFor(() => expect(byId("account-over-limits")).not.toBeNull());
		const banner = within(byId("account-over-limits") ?? document.body);
		expect(
			banner.getByText(
				"You're above the Free limits: 7/3 projects, 49/10 resources.",
			),
		).toBeVisible();
		expect(
			banner.getByText(
				"Everything keeps working; creating more is blocked until you're under the limits.",
			),
		).toBeVisible();
	});

	it("shows no banner within the limits", async () => {
		renderAccount(trialUser("used"), {}, usage({ overLimits: [] }));
		await screen.findByRole("meter", { name: "Projects" });
		expect(byId("account-over-limits")).toBeNull();
	});
});
