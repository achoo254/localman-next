import { expect, test } from "@playwright/test";

// Accounts are deleted only at the IdP, which tells Localman
// (POST /internal/account-deleted, covered by the API tests); Localman
// keeps only the public page explaining it.
test("the legal pages and the deletion page open without signing in @smoke", async ({
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
	await page.getByTestId("foot-privacy").click();
	await page.waitForURL("**/privacy");
});
