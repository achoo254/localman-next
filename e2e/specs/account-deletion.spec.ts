import { expect, test } from "@playwright/test";
import { createProject } from "../support/projects-ui.js";
import { signIn, uniqueUsername } from "../support/session.js";

test("a user deletes their account from Account and stays signed out", async ({
	page,
}) => {
	const username = uniqueUsername("delete");
	await signIn(page, username);
	await createProject(page, "Doomed shop");

	await page.goto("/account");
	await page.getByTestId("account-delete-open").click();
	const modal = page.getByTestId("delete-account-modal");
	await expect(modal.getByTestId("delete-account-summary")).toContainText(
		"1 mock project you own, with its data",
	);
	const confirm = page.getByTestId("delete-account-modal-confirm");
	await expect(confirm).toBeDisabled();
	await modal.getByTestId("delete-account-confirm-input").fill(username);
	await confirm.click();

	await page.waitForURL("**/account/delete?deleted=1");
	await expect(page.getByTestId("legal-account-deleted")).toBeVisible();

	// The session is gone and the silent sign-in hint too: the IdP session
	// that is still alive does not bring the visitor back as a new account.
	const probe = page.waitForResponse("**/api/v1/users/me");
	await page.goto("/docs/quick-start");
	expect((await probe).status()).toBe(401);
	await expect(page.getByTestId("topbar-login")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/docs/quick-start");

	// Signing in again with the live IdP session stops at a choice; only the
	// click makes a new, empty account.
	await page.getByTestId("topbar-login").click();
	await page.waitForURL("**/?authError=account_deleted");
	await expect(page.getByTestId("landing-auth-error")).toBeVisible();
	await page.getByTestId("landing-auth-error-recreate").click();
	await page.waitForURL("**/projects");
	await expect(page.getByTestId("projects-add")).toBeVisible();
});

test("the legal pages and the deletion page open without signing in", async ({
	page,
}) => {
	for (const [path, heading] of [
		["/privacy", "Privacy Policy"],
		["/terms", "Terms of Use"],
		["/account/delete", "Delete your Localman account"],
	] as const) {
		await page.goto(path);
		await expect(
			page.getByRole("heading", { level: 1, name: heading }),
		).toBeVisible();
	}
	// Sign-up shows the terms; every page footer links all three pages.
	await page.goto("/");
	await expect(page.getByTestId("landing-hero-legal")).toContainText("Terms");
	await page.getByTestId("app-footer-legal-privacy").click();
	await page.waitForURL("**/privacy");
});
