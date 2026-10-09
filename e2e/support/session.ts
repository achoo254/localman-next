import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { IDP_ORIGIN, IDP_USER_COOKIE } from "./ports.js";

/** Random tag so names and usernames never collide between tests or runs. */
export function uniqueSuffix(): string {
	return randomBytes(4).toString("hex");
}

/** A username no other test uses; the first sign-in creates the account. */
export function uniqueUsername(label: string, suffix = uniqueSuffix()): string {
	return `e2e_${label}_${suffix}`;
}

/**
 * Signs `username` in through the sign-in link of the landing page. The
 * fake IdP completes the login as that account (cookie on the IdP origin),
 * then Localman returns to /projects.
 */
export async function signIn(
	page: Page,
	username: string,
	link: "topbar-login" | "topbar-signup" = "topbar-login",
): Promise<void> {
	await page
		.context()
		.addCookies([{ name: IDP_USER_COOKIE, value: username, url: IDP_ORIGIN }]);
	await page.goto("/");
	await page.getByTestId(link).click();
	await page.waitForURL("**/projects");
}
