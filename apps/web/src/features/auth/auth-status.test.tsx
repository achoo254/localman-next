import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellSessionLoading } from "./auth-status";

describe("ShellSessionLoading", () => {
	it("draws the top bar and the page container while the session loads", async () => {
		const { container } = render(<ShellSessionLoading />);
		// Nothing for the first 150 ms, so a fast session does not flash it.
		expect(container).toBeEmptyDOMElement();
		const topbar = await waitFor(() => {
			const found = container.querySelector('[data-id="auth-loading-topbar"]');
			if (!found) throw new Error("no placeholder yet");
			return found;
		});
		expect(topbar.firstElementChild).toHaveClass("max-w-page", "mx-auto");
		const skeleton = container.querySelector('[data-id="auth-loading"]');
		expect(skeleton?.parentElement).toHaveClass("max-w-page", "mx-auto");
		expect(skeleton).toHaveAttribute("aria-busy", "true");
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"Checking your session…",
			),
		);
	});
});
