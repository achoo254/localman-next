import { type Page, expect, test } from "@playwright/test";
import {
	chooseRoute,
	newRequestTab,
	openApiClient,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { WEB_ORIGIN } from "../support/ports.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";
import {
	approveLink,
	httpTunnel,
	setAccountTunnels,
	setDeviceTunnels,
} from "../support/tunelo-control.js";

/** Account id the fake IdP gives `username` (and the fake Tunelo reads). */
const subOf = (username: string) => `acc_${username}`;

/**
 * The proxy calls of the page, answered 200 without leaving the stack: the
 * tunnel domain is not reachable from the E2E machine. Returns the target
 * URLs, in order.
 */
async function answerTunnelCalls(page: Page): Promise<string[]> {
	const urls: string[] = [];
	await page.route("**/api/v1/proxy", async (route) => {
		const payload: unknown = JSON.parse(route.request().postData() ?? "{}");
		const url =
			typeof payload === "object" && payload !== null && "url" in payload
				? String(payload.url)
				: "";
		urls.push(url);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				status: 200,
				statusText: "OK",
				headers: [{ name: "content-type", value: "text/plain" }],
				body: "from the tunnel",
				bodyEncoding: "utf8",
				size: 15,
				timings: { dns: null, connect: null, tls: null, ttfb: 5, total: 5 },
				finalUrl: url,
				truncated: false,
			}),
		});
	});
	return urls;
}

/** A port per test: nothing listens there, so a direct send fails at once. */
function localPort(): number {
	return 47000 + Math.floor(Math.random() * 900);
}

async function openTab(page: Page, username: string): Promise<string[]> {
	await signIn(page, username);
	await openApiClient(page);
	await newRequestTab(page);
	return answerTunnelCalls(page);
}

test("one tunnel of the account: Check again sends through it with a badge", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("tunelo-auto", suffix);
	const port = localPort();
	const calls = await openTab(page, username);
	await setUrl(page, `http://localhost:${port}/users?x=1`);
	await send(page);
	await expect(page.getByTestId("tunelo-panel")).toBeVisible();
	expect(calls).toEqual([]);

	await setAccountTunnels(subOf(username), [
		httpTunnel(`auto${suffix}`, port, "dev-laptop"),
	]);
	// One click is enough: a refresh of a list younger than 2 seconds
	// waits until it is that old, then reads it anew.
	const tunnelUrl = `https://auto${suffix}.tunnel.hoandat.com`;
	await page.getByTestId("tunelo-recheck").click();
	await expect.poll(() => calls.length).toBe(1);
	expect(calls).toEqual([`${tunnelUrl}/users?x=1`]);
	await expect(page.getByTestId("request-url-auto-tunnel-badge")).toHaveText(
		/Via Tunelo · dev-laptop/,
	);
	await expect(page.getByTestId("response-route-badge")).toHaveAttribute(
		"data-route",
		"tunelo",
	);
});

test("two tunnels for the port: the user picks one, once", async ({ page }) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("tunelo-two", suffix);
	const port = localPort();
	await setAccountTunnels(subOf(username), [
		httpTunnel(`one${suffix}`, port, "laptop"),
		httpTunnel(`two${suffix}`, port, "office-pc"),
	]);
	const calls = await openTab(page, username);
	await chooseRoute(page, "proxy");
	await setUrl(page, `http://localhost:${port}/items`);
	await send(page);

	const modal = page.getByTestId("modal-choose-tunnel");
	await expect(modal).toBeVisible();
	await modal
		.getByTestId("modal-choose-tunnel-option")
		.filter({ hasText: "office-pc" })
		.click();
	const second = `https://two${suffix}.tunnel.hoandat.com/items`;
	await expect.poll(() => calls).toEqual([second]);

	await send(page);
	await expect.poll(() => calls).toEqual([second, second]);
	await expect(modal).toBeHidden();
});

test("a linked machine's tunnel is used until the link is revoked", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("tunelo-link", suffix);
	const port = localPort();
	const device = `device-${suffix}`;
	await setDeviceTunnels(device, [httpTunnel(`pc${suffix}`, port, "anon-pc")]);
	const calls = await openTab(page, username);

	await page.getByTestId("sidebar-rail-tunelo").click();
	await page.getByTestId("settings-tunelo-link-start").click();
	const code = await page.getByTestId("tunelo-connect-code").innerText();
	await expect(page.getByTestId("tunelo-connect-command")).toContainText(
		`tunelo link ${code}`,
	);
	await approveLink(code, device);
	await expect(page.getByTestId("tunelo-connect-linked")).toBeVisible();
	await page.getByTestId("modal-tunelo-connect-close").click();
	await expect(page.getByTestId("settings-tunelo-link")).toHaveCount(1);

	await chooseRoute(page, "proxy");
	await setUrl(page, `http://localhost:${port}/me`);
	await send(page);
	await expect
		.poll(() => calls)
		.toEqual([`https://pc${suffix}.tunnel.hoandat.com/me`]);

	await page.getByTestId("settings-tunelo-link-revoke").click();
	await expect(page.getByTestId("settings-tunelo-links-empty")).toBeVisible();
	await send(page);
	await expect(page.getByTestId("tunelo-panel")).toBeVisible();
	expect(calls).toHaveLength(1);
});

test("another user sees none of the account's tunnels or links", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	const owner = uniqueUsername("tunelo-mine", suffix);
	const port = localPort();
	await setAccountTunnels(subOf(owner), [
		httpTunnel(`mine${suffix}`, port, "owner-pc"),
	]);
	const other = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const otherPage = await other.newPage();
		const calls = await openTab(
			otherPage,
			uniqueUsername("tunelo-else", suffix),
		);
		await chooseRoute(otherPage, "proxy");
		await setUrl(otherPage, `http://localhost:${port}/users`);
		await send(otherPage);
		await expect(otherPage.getByTestId("tunelo-panel")).toBeVisible();
		expect(calls).toEqual([]);
		await otherPage.getByTestId("sidebar-rail-tunelo").click();
		await expect(
			otherPage.getByTestId("settings-tunelo-links-empty"),
		).toBeVisible();
	} finally {
		await other.close();
	}
	// The owner does get it.
	const calls = await openTab(page, owner);
	await chooseRoute(page, "proxy");
	await setUrl(page, `http://localhost:${port}/users`);
	await send(page);
	await expect.poll(() => calls).toHaveLength(1);
});
