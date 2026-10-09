import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { IDP_ORIGIN, IDP_USER_COOKIE } from "./ports.js";

/** Random tag so names and usernames never collide between tests or runs. */
export function uniqueSuffix(): string {
	return randomBytes(4).toString("hex");
}

/** A random IPv4 address from the documentation range 198.51.100.0/24's siblings. */
function randomClientIp(): string {
	const octets = randomBytes(2);
	return `198.51.${octets[0] ?? 0}.${octets[1] ?? 0}`;
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
	// The login routes are rate limited per client IP, and every test runs from
	// 127.0.0.1. The E2E stack trusts its loopback proxy, so the sign-in
	// requests carry their own forwarded address: each test gets its own bucket,
	// as distinct clients would. Other requests are left as they are.
	const clientIp = randomClientIp();
	await page.route("**/auth/**", (route) =>
		route.continue({
			headers: { ...route.request().headers(), "x-forwarded-for": clientIp },
		}),
	);
	await page
		.context()
		.addCookies([{ name: IDP_USER_COOKIE, value: username, url: IDP_ORIGIN }]);
	await page.goto("/");
	await page.getByTestId(link).click();
	await page.waitForURL("**/projects");
}
