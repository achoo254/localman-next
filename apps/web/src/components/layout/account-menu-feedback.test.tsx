import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FeaturesContext } from "../../config/features";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import { makeUser } from "../../test/fixtures";
import { renderRoutes } from "../../test/render-app";
import { AccountMenu } from "./account-menu";

describe("account menu entry 'Feedback / Contact'", () => {
	it("opens the feedback form on a page without the footer", async () => {
		// The API client is a workbench page: no footer, so no footer link.
		renderRoutes(
			[
				{
					path: "*",
					element: (
						<FeaturesContext value={ALL_FEATURES}>
							<AccountMenu
								user={makeUser()}
								logoutBusy={false}
								onLogout={() => undefined}
							/>
						</FeaturesContext>
					),
				},
			],
			"/api-client",
		);
		screen.getByRole("button", { name: "Minh Anh · Account" }).focus();
		await userEvent.keyboard("{Enter}");
		const item = await screen.findByRole("menuitem", {
			name: "Feedback / Contact",
		});
		expect(item).toHaveAttribute("data-id", "account-menu-feedback");
		await userEvent.click(item);
		expect(
			await screen.findByRole("dialog", { name: "Feedback / Contact" }),
		).toBeVisible();
	});
});
