import { type PlanId, limitsFor } from "@localman/shared/constants";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { planItems } from "../../features/subscription/plan-card";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import {
	ALL_FEATURES,
	itemsOf,
	renderWithFeatures,
} from "./landing-test-helpers";
import { PricingTable } from "./pricing-table";

const english = createTranslator("en", en).t;

function renderTable(flags = NO_FEATURES, plan: PlanId | null = null) {
	const onContactPro = vi.fn();
	const view = renderWithFeatures(
		<PricingTable onContactPro={onContactPro} plan={plan} />,
		flags,
	);
	return { ...view, onContactPro };
}

describe("PricingTable", () => {
	it("lists Free and Pro from plan-limits without the proxy while the API client is off", () => {
		const { container } = renderTable();
		expect(itemsOf(container, "pricing-card-free")).toMatchInlineSnapshot(`
			[
			  "3 projects",
			  "10 resources per project",
			  "Custom responses and object templates",
			  "Up to 3 members per project, including you",
			  "10,000 mock requests per month",
			]
		`);
		expect(itemsOf(container, "pricing-card-pro")).toMatchInlineSnapshot(`
			[
			  "20 projects",
			  "50 resources per project",
			  "Custom responses and object templates",
			  "Up to 10 members per project, including you",
			  "Unlimited mock requests per month",
			]
		`);
		const free = limitsFor("free");
		expect(itemsOf(container, "pricing-card-free")).toContain(
			english("subscription.plan.mockRequests", {
				count: free.mockRequestsPerMonth ?? 0,
			}),
		);
		expect(container.textContent).not.toMatch(/proxy/i);
	});

	it("adds the proxy quota once the API client is released", () => {
		const { container } = renderTable(ALL_FEATURES);
		expect(itemsOf(container, "pricing-card-free")).toMatchInlineSnapshot(`
			[
			  "3 projects",
			  "10 resources per project",
			  "Custom responses and object templates",
			  "Up to 3 members per project, including you",
			  "10,000 mock requests per month",
			  "5,000 proxy requests per month",
			]
		`);
		expect(itemsOf(container, "pricing-card-pro")).toMatchInlineSnapshot(`
			[
			  "20 projects",
			  "50 resources per project",
			  "Custom responses and object templates",
			  "Up to 10 members per project, including you",
			  "Unlimited mock requests per month",
			  "Unlimited proxy requests per month",
			]
		`);
	});

	it("renders exactly the items planItems derives from limitsFor", () => {
		for (const flags of [NO_FEATURES, ALL_FEATURES]) {
			const { container, unmount } = renderTable(flags);
			for (const plan of ["free", "pro"] as const) {
				expect(itemsOf(container, `pricing-card-${plan}`)).toEqual(
					planItems(limitsFor(plan), flags, english).map(([, label]) => label),
				);
			}
			unmount();
		}
	});

	it("shows a price for Free only and a contact button for Pro", async () => {
		const { container, onContactPro } = renderTable();
		expect(
			container.querySelector('[data-id="pricing-card-free-price"]'),
		).toHaveTextContent("Free");
		const pro = container.querySelector('[data-id="pricing-card-pro"]');
		expect(pro?.textContent).not.toMatch(/₫|đ\/|\$|chưa chốt|not decided/i);
		expect(pro).toHaveTextContent("Interest list open");
		await userEvent.click(screen.getByRole("button", { name: "Contact" }));
		expect(onContactPro).toHaveBeenCalledTimes(1);
	});

	it("invites visitors to sign up from the Free card", () => {
		renderTable();
		expect(
			screen.getByRole("link", { name: "Get started free" }),
		).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects&prompt=create");
		expect(screen.queryByText("Current plan")).toBeNull();
	});

	it("marks a Free user's plan and opens the app instead of signing up", () => {
		const { container } = renderTable(NO_FEATURES, "free");
		expect(screen.queryByRole("link", { name: "Get started free" })).toBeNull();
		expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute(
			"href",
			"/projects",
		);
		expect(
			container.querySelector('[data-id="pricing-card-free"]'),
		).toHaveTextContent("Current plan");
		expect(screen.getByRole("button", { name: "Contact" })).toBeVisible();
	});

	it("marks a Pro user's plan without asking them to contact us", () => {
		const { container } = renderTable(NO_FEATURES, "pro");
		const pro = container.querySelector('[data-id="pricing-card-pro"]');
		expect(pro).toHaveTextContent("Current plan");
		expect(pro).not.toHaveTextContent("Interest list open");
		expect(screen.queryByRole("button", { name: "Contact" })).toBeNull();
	});
});
