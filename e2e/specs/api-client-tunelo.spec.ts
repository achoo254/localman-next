import { type Page, expect, test } from "@playwright/test";
import {
	newRequestTab,
	openApiClient,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { WEB_ORIGIN } from "../support/ports.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** A port nothing listens on: the browser's direct send fails at once. */
const LOCAL_PORT = 46990;
/** A tunnel URL on the form's domains (https only). */
const TUNNEL_URL = "https://echo.tunnel.hoandat.com";

/**
 * A tunnel hop goes through the Localman
 * proxy, so the proxy call is recorded and aborted: nothing reaches the
 * tunnel domain. Returns the target URLs of the calls, in order.
 */
async function captureTunnelCalls(page: Page): Promise<string[]> {
	const urls: string[] = [];
	await page.route("**/api/v1/proxy", async (route) => {
		const payload: unknown = JSON.parse(route.request().postData() ?? "{}");
		if (
			typeof payload === "object" &&
			payload !== null &&
			"url" in payload &&
			typeof payload.url === "string"
		) {
			urls.push(payload.url);
		}
		await route.abort();
	});
	return urls;
}

test("a local address with no tunnel shows the Tunelo panel", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("tunelo-panel", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	await setUrl(page, `http://localhost:${LOCAL_PORT}/users`);
	await send(page);

	const panel = page.getByTestId("tunelo-panel");
	await expect(panel).toBeVisible();
	await expect(panel).toContainText(`tunelo http ${LOCAL_PORT}`);
});

test("a pasted tunnel URL is saved for the port and the URL shows the tunnel", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("tunelo-paste", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	const calls = await captureTunnelCalls(page);
	await setUrl(page, `http://localhost:${LOCAL_PORT}/cors/users?x=1`);
	await send(page);
	await expect(page.getByTestId("tunelo-paste")).toBeVisible();

	await page.getByTestId("tunelo-paste-input").fill(TUNNEL_URL);
	await page.getByTestId("tunelo-paste-submit").click();

	// The saved mapping sends the request again: same path and query on the tunnel.
	await expect(page.getByTestId("request-url-tunnel-badge")).toBeVisible();
	await expect.poll(() => calls.length).toBe(1);
	expect(calls).toEqual([`${TUNNEL_URL}/cors/users?x=1`]);
	await page.getByTestId("sidebar-rail-tunelo").click();
	await expect(page.getByTestId("settings-tunelo-mapping")).toHaveCount(1);
});

test("a tunnel mapping belongs to its account", async ({ page, browser }) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("tunelo-owner", suffix));
	await openApiClient(page);
	await newRequestTab(page);
	await captureTunnelCalls(page);
	await setUrl(page, `http://localhost:${LOCAL_PORT}/cors/owned`);
	await send(page);
	await page.getByTestId("tunelo-paste-input").fill(TUNNEL_URL);
	await page.getByTestId("tunelo-paste-submit").click();
	await expect(page.getByTestId("request-url-tunnel-badge")).toBeVisible();

	await page.getByTestId("sidebar-rail-tunelo").click();
	await expect(page.getByTestId("settings-tunelo-mapping")).toHaveCount(1);

	const other = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const otherPage = await other.newPage();
		await signIn(otherPage, uniqueUsername("tunelo-other", suffix));
		await openApiClient(otherPage);
		await otherPage.getByTestId("sidebar-rail-tunelo").click();
		await expect(
			otherPage.getByTestId("settings-tunelo-mappings-empty"),
		).toBeVisible();
	} finally {
		await other.close();
	}
});
