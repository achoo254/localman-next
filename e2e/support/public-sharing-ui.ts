import { type Page, expect } from "@playwright/test";
import { IDP_ORIGIN, IDP_USER_COOKIE } from "./ports.js";
import { SECRET_LITERALS } from "./public-sharing-seed.js";

/** Opens the Share dialog of a collection from its sidebar menu. */
export async function openShareDialog(page: Page, name: string): Promise<void> {
	const row = page
		.getByTestId("sidebar-tree")
		.getByTestId("sidebar-tree-collection")
		.filter({ hasText: name });
	await row.hover();
	await row.getByTestId("sidebar-tree-more").click();
	await page.getByTestId("node-menu-share").click();
	await expect(page.getByTestId("share-dialog")).toBeVisible();
}

/** Turns a link on through its dry run and confirm step; returns its URL. */
export async function turnOnLink(
	page: Page,
	kind: "public" | "guest",
): Promise<string> {
	await page.getByTestId("share-tab-public").click();
	await page.getByTestId(`share-${kind}-link-switch`).click();
	const confirm = page.getByTestId(`share-${kind}-link-confirm`);
	await expect(confirm.getByTestId("secret-warning")).toBeVisible();
	await page.getByTestId(`share-${kind}-link-confirm-confirm`).click();
	const url = page.getByTestId(`share-${kind}-link-url`);
	await expect(url).toHaveValue(/\/(public\/c|guest)\/[\w-]{43}$/);
	return url.inputValue();
}

/** None of the seeded secrets anywhere on the page. */
export async function expectNoSecretsOn(page: Page): Promise<void> {
	const text = await page.locator("body").innerText();
	for (const literal of SECRET_LITERALS) expect(text).not.toContain(literal);
}

/**
 * Lets the fake IdP sign `username` in on the next sign-in redirect, with
 * its own client address (sign-in routes are rate limited per IP).
 */
export async function prepareSignIn(
	page: Page,
	username: string,
): Promise<void> {
	const clientIp = `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
	await page.route("**/auth/**", (route) =>
		route.continue({
			headers: { ...route.request().headers(), "x-forwarded-for": clientIp },
		}),
	);
	await page
		.context()
		.addCookies([{ name: IDP_USER_COOKIE, value: username, url: IDP_ORIGIN }]);
}
