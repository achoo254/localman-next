import { type Request, expect, test } from "@playwright/test";
import {
	chooseRoute,
	echoBody,
	newRequestTab,
	openApiClient,
	pasteCurl,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** The Localman proxy endpoint (`POST /api/v1/proxy`). */
const PROXY_PATH = "/api/v1/proxy";

/** Requests the page sent to the Localman proxy, collected while the test runs. */
function trackProxyCalls(page: import("@playwright/test").Page): Request[] {
	const calls: Request[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname === PROXY_PATH) calls.push(request);
	});
	return calls;
}

test.describe("routing of a request", () => {
	test("a CORS target is called straight from the browser", async ({
		page,
	}) => {
		await signIn(page, uniqueUsername("route-cors", uniqueSuffix()));
		const proxyCalls = trackProxyCalls(page);
		await openApiClient(page);
		await newRequestTab(page);
		await setUrl(page, `${ECHO_ORIGIN}/cors/hello?x=1`);
		await send(page);

		await expect(page.getByTestId("response-route-badge")).toContainText(
			"Direct",
		);
		const echo = await echoBody(page);
		expect(echo.method).toBe("GET");
		expect(echo.url).toBe("/cors/hello?x=1");
		expect(proxyCalls).toHaveLength(0);
	});

	test("a redirect is followed by the browser and the final answer is shown", async ({
		page,
	}) => {
		await signIn(page, uniqueUsername("route-redirect", uniqueSuffix()));
		await openApiClient(page);
		await newRequestTab(page);
		await setUrl(page, `${ECHO_ORIGIN}/redirect/go`);
		await send(page);

		const echo = await echoBody(page);
		expect(echo.url).toBe("/cors/redirected");
	});

	test("a POST without CORS is not silently sent through the proxy", async ({
		page,
	}) => {
		await signIn(page, uniqueUsername("route-nocors", uniqueSuffix()));
		const proxyCalls = trackProxyCalls(page);
		await openApiClient(page);
		await newRequestTab(page);
		await pasteCurl(
			page,
			`curl -X POST '${ECHO_ORIGIN}/plain/items' -H 'Content-Type: application/json' -d '{"name":"box"}'`,
		);
		await page.getByTestId("modal-curl-import-confirm").click();
		await send(page);

		// Localhost never goes through the proxy: the browser's refusal shows
		// the Tunelo panel instead of a silent second send.
		await expect(page.getByTestId("tunelo-panel")).toBeVisible();
		await expect(page.getByTestId("response-route-badge")).toHaveCount(0);
		expect(proxyCalls).toHaveLength(0);
	});

	test("a header the browser cannot set asks before the proxy sends it", async ({
		page,
	}) => {
		await signIn(page, uniqueUsername("route-consent", uniqueSuffix()));
		const proxyCalls = trackProxyCalls(page);
		await openApiClient(page);
		await newRequestTab(page);
		// Cookie is forbidden for fetch, so Auto would switch to the proxy and
		// must ask first. The host is never contacted: the answer is declined.
		await pasteCurl(
			page,
			"curl 'http://api.example.com/private' -H 'Cookie: sid=secret-value'",
		);
		await page.getByTestId("modal-curl-import-confirm").click();
		await send(page);

		await expect(page.getByTestId("modal-route-secret")).toBeVisible();
		await page.getByTestId("modal-route-secret-cancel").click();
		await expect(page.getByTestId("response-route-consent")).toBeVisible();
		expect(proxyCalls).toHaveLength(0);
	});

	test("the proxy refuses a mail port and names the blocked target", async ({
		page,
	}) => {
		await signIn(page, uniqueUsername("route-blocked", uniqueSuffix()));
		const proxyCalls = trackProxyCalls(page);
		await openApiClient(page);
		await newRequestTab(page);
		await setUrl(page, "http://mail.example.com:25/");
		await chooseRoute(page, "proxy");
		await send(page);

		await expect(page.getByTestId("response-error-code")).toContainText(
			"PROXY_TARGET_BLOCKED",
		);
		expect(proxyCalls).toHaveLength(1);
		expect(proxyCalls[0]?.method()).toBe("POST");
	});
});
