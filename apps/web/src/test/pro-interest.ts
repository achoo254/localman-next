import { screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

/**
 * Waits for the Pro interest modal and its lazily loaded form, then checks
 * which entry point the submission will be recorded under.
 */
export async function expectProInterestSource(source: string): Promise<void> {
	const dialog = await screen.findByRole("dialog", {
		name: "Contact us about Pro",
	});
	await waitFor(() =>
		expect(
			dialog.querySelector('[data-id="pro-interest-form"]'),
		).toHaveAttribute("data-source", source),
	);
}
