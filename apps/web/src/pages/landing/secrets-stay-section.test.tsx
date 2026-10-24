import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { LandingPage } from "./landing-page";
import { ALL_FEATURES, renderWithFeatures } from "./landing-test-helpers";

describe("the landing block on secrets staying in the browser", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});

	it("shows with the vault released and links to where the data lives", async () => {
		renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(
			await screen.findByRole("heading", {
				level: 2,
				name: "Secrets never leave the browser",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Where your data lives" }),
		).toHaveAttribute("href", "/your-data");
	});

	it("is absent while the vault is not released", async () => {
		const { container } = renderWithFeatures(<LandingPage />, {
			...ALL_FEATURES,
			secretVault: false,
		});
		// Wait for the other lazy blocks, so the absence is not just loading.
		await screen.findByRole("heading", {
			level: 2,
			name: "Your mock becomes a tool for AI agents",
		});
		expect(container.querySelector('[data-id="landing-secrets"]')).toBeNull();
	});
});
