import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { WEB_ORIGIN } from "../support/ports.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * A team workspace from creation to a second member: the owner creates it
 * from the switcher, invites with a one-use link, the invitee joins as
 * Editor, the owner makes them Admin, then they leave on their own.
 */
test("create a team workspace, invite by link, change the role and leave", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("ws-owner", suffix));
	await openApiClient(page);

	await page.getByTestId("app-header-workspace").click();
	await page.getByTestId("ws-menu-create").click();
	await page.getByTestId("modal-create-workspace-name").fill("Team E2E");
	await page.getByTestId("modal-create-workspace-submit").click();
	await expect(page.getByTestId("app-header-workspace")).toContainText(
		"Team E2E",
	);

	await page.getByTestId("app-header-workspace").click();
	await page.getByTestId("ws-menu-settings").click();
	await page.getByTestId("ws-settings-tab-members").click();
	await page.getByTestId("ws-settings-invite-link").click();
	const link = await page.getByTestId("ws-settings-invite-url").inputValue();
	expect(link).toMatch(/\/workspace-invite\/[\w-]+$/);

	const other = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const guest = await other.newPage();
		await signIn(guest, uniqueUsername("ws-guest", suffix));
		await guest.goto(new URL(link).pathname);
		await guest.getByTestId("ws-invite-page-accept").click();
		await guest.waitForURL("**/api-client");
		await expect(guest.getByTestId("app-header-workspace")).toContainText(
			"Team E2E",
		);

		await page.reload();
		await page.getByTestId("ws-settings-tab-members").click();
		const guestRow = page
			.getByTestId("ws-settings-member")
			.filter({ hasText: "ws-guest" });
		await expect(guestRow).toBeVisible();
		await guestRow.getByTestId("ws-settings-member-role").selectOption("admin");
		await expect(guestRow.getByTestId("ws-settings-member-role")).toHaveValue(
			"admin",
		);

		await guest.goto("/workspace/settings");
		await guest.getByTestId("ws-settings-tab-members").click();
		await guest.getByTestId("ws-settings-leave").click();
		await guest.getByTestId("ws-settings-leave-confirm-confirm").click();
		await expect(guest.getByTestId("ws-settings-leave-confirm")).toBeHidden();
		await page.reload();
		await page.getByTestId("ws-settings-tab-members").click();
		await expect(page.getByTestId("ws-settings-member")).toHaveCount(1);
	} finally {
		await other.close();
	}
});
