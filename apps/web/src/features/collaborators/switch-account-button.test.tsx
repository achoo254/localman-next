import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushSupport } from "../../platform/push-support";
import { SwitchAccountButton } from "./switch-account-button";

describe("SwitchAccountButton", () => {
	afterEach(() => vi.restoreAllMocks());

	it("logs out once through the shared logout, showing that it is busy", async () => {
		const submit = vi
			.spyOn(HTMLFormElement.prototype, "submit")
			.mockImplementation(() => undefined);
		let release = (_: null) => {};
		vi.spyOn(pushSupport, "currentEndpoint").mockReturnValue(
			new Promise<null>((resolve) => {
				release = resolve;
			}),
		);
		const { container } = render(<SwitchAccountButton variant="primary" />);
		const form = container.querySelector('[data-id="invite-page-logout-form"]');
		expect(form).toHaveAttribute("method", "post");
		expect(form).toHaveAttribute("action", "/auth/logout");
		const button = screen.getByRole("button", {
			name: "Sign in with another account",
		});
		await userEvent.click(button);
		await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
		// Still focusable, but inert while signing out.
		expect(button).toHaveAttribute("aria-disabled", "true");
		expect(
			button.querySelector('[data-id="button-spinner"]'),
		).toBeInTheDocument();
		release(null);
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
	});
});
