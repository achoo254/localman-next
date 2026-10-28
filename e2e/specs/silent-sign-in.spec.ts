import { expect, test } from "@playwright/test";
import { IDP_ORIGIN } from "../support/ports.js";
import { signIn, uniqueUsername } from "../support/session.js";

test("a browser still signed in at the IdP comes back signed in without a click @smoke", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("silent"));
	// The Localman session ends (e.g. a logout from another app), while the
	// IdP session and the "signed in before" hint stay.
	await page.context().clearCookies({ name: "lm_session" });

	await page.goto("/docs/quick-start");
	const bar = page.getByTestId("public-header");
	await expect(bar.getByTestId("topbar-account")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/docs/quick-start");
});

test("a first-time visitor stays a guest without a trip to the IdP @smoke", async ({
	page,
}) => {
	const idpRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().startsWith(IDP_ORIGIN)) idpRequests.push(request.url());
	});
	const probe = page.waitForResponse("**/api/v1/users/me");
	await page.goto("/");
	expect((await probe).status()).toBe(401);
	await expect(page.getByTestId("public-sign-in")).toBeVisible();
	expect(idpRequests).toEqual([]);
});
