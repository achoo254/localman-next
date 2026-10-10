import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../../features/auth/current-user";
import {
	type TrialCase,
	freezeTrialClock,
	trialUser,
} from "../../features/subscription/trial-test-helpers";
import { renderWithFeatures } from "./landing-test-helpers";
import { PricingTable } from "./pricing-table";

function renderPro(user: CurrentUser | null) {
	const onContactPro = vi.fn();
	const onStartTrial = vi.fn();
	renderWithFeatures(
		<PricingTable
			onContactPro={onContactPro}
			onStartTrial={onStartTrial}
			user={user}
		/>,
	);
	const card = document.querySelector('[data-id="pricing-card-pro"]');
	if (!(card instanceof HTMLElement)) throw new Error("no Pro card");
	return { card: within(card), element: card, onContactPro, onStartTrial };
}

const cta = () => document.querySelector('[data-id="pricing-card-pro-cta"]');

describe("Pro card by trial state", () => {
	beforeEach(() => freezeTrialClock());
	afterEach(() => vi.useRealTimers());

	it("sends a visitor to sign in and back to the trial confirmation", () => {
		const { card } = renderPro(null);
		expect(
			card.getByRole("link", { name: "Start free trial" }),
		).toHaveAttribute(
			"href",
			"/auth/login?returnTo=%2Fpricing%3Ftrial%3Dstart",
		);
		expect(
			card.getByRole("button", { name: "Tell us what you need from Pro" }),
		).toBeVisible();
	});

	it("offers a Free user the 30-day trial", async () => {
		const { card, onStartTrial } = renderPro(trialUser("available"));
		await userEvent.click(
			card.getByRole("button", { name: "Start 30-day trial" }),
		);
		expect(onStartTrial).toHaveBeenCalledTimes(1);
	});

	it("counts down a running trial and links to the account", () => {
		const { card, element } = renderPro(trialUser("active"));
		expect(cta()).toHaveTextContent("Trial ends in 12 days");
		expect(
			card.getByRole("link", { name: "See it in your account" }),
		).toHaveAttribute("href", "/account");
		expect(element).toHaveTextContent("Current plan");
		expect(card.queryByRole("button", { name: /Start/ })).toBeNull();
	});

	it("says the trial ends today on its last day", () => {
		renderPro(
			trialUser("active", {
				trial: {
					status: "active",
					startedAt: "2026-09-10T03:00:00.000Z",
					endsAt: "2026-10-10T16:59:59.999Z",
					extensionRequest: null,
				},
			}),
		);
		expect(cta()).toHaveTextContent("Trial ends today");
	});

	it("offers an extension within a week after the trial", () => {
		const { card } = renderPro(trialUser("used"));
		expect(cta()).toHaveTextContent("Trial used");
		expect(
			card.getByRole("link", { name: "Request an extension" }),
		).toHaveAttribute("href", "/account");
	});

	it.each<[string, TrialCase, Partial<CurrentUser>]>([
		["past the week", "usedLong", {}],
		[
			"while a request waits",
			"used",
			{
				trial: {
					status: "ended",
					startedAt: "2026-09-07T03:00:00.000Z",
					endsAt: "2026-10-07T16:59:59.999Z",
					extensionRequest: {
						status: "pending",
						requestedAt: "2026-10-08T03:00:00.000Z",
						decidedAt: null,
					},
				},
			},
		],
	])("shows no extension link %s", (_, kind, overrides) => {
		const { card } = renderPro(trialUser(kind, overrides));
		expect(cta()).toHaveTextContent("Trial used");
		expect(
			card.queryByRole("link", { name: "Request an extension" }),
		).toBeNull();
		expect(
			card.getByRole("button", { name: "Tell us what you need from Pro" }),
		).toBeVisible();
	});

	it("shows Current plan for Pro granted by the owner", () => {
		const { card } = renderPro(trialUser("pro"));
		expect(cta()).toHaveTextContent("Current plan");
		expect(card.queryByRole("button")).toBeNull();
		expect(card.queryByRole("link")).toBeNull();
		expect(screen.getByText("Paid plans aren't available yet.")).toBeVisible();
	});
});
