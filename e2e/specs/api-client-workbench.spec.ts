import { expect, test } from "@playwright/test";
import {
	echoBody,
	newRequestTab,
	openApiClient,
	pasteCurl,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { axeViolations } from "../support/axe.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

test("a tab and its URL survive a reload", async ({ page }) => {
	await signIn(page, uniqueUsername("draft", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	const url = `${ECHO_ORIGIN}/cors/draft?kept=1`;
	// The draft is saved after a short debounce: wait for that save.
	const saved = page.waitForResponse(
		(response) =>
			response.request().method() !== "GET" &&
			/draft/i.test(new URL(response.url()).pathname),
	);
	await setUrl(page, url);
	await saved;

	await page.reload();
	await expect(page.getByTestId("request-url")).toHaveValue(url);
	await expect(page.getByTestId("tabbar-tab")).toHaveCount(1);
});

test("a finished send is listed in History and opens a new tab", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("history", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	const url = `${ECHO_ORIGIN}/cors/history-entry`;
	await setUrl(page, url);
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");

	// Collections is the first section when workspaces are on; History is a click away.
	await page.getByTestId("sidebar-rail-history").click();
	await expect(page.getByTestId("sidebar-history-item")).toHaveCount(1);
	await newRequestTab(page);
	await page.getByTestId("sidebar-history-item").first().click();
	await expect(page.getByTestId("request-url")).toHaveValue(url);
});

test("a pasted cURL command becomes a request with its body", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("curl", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	await pasteCurl(
		page,
		`curl -X POST '${ECHO_ORIGIN}/cors/items' -H 'Content-Type: application/json' -d '{"name":"box"}'`,
	);
	await page.getByTestId("modal-curl-import-confirm").click();
	await expect(page.getByTestId("request-method")).toHaveValue("POST");
	await send(page);

	const echo = await echoBody(page);
	expect(echo.method).toBe("POST");
	expect(echo.url).toBe("/cors/items");
	expect(echo.body).toBe('{"name":"box"}');
});

test("a pre-request script sets a header and a post-response test passes", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("scripts", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	await setUrl(page, `${ECHO_ORIGIN}/cors/scripted`);
	await page.getByTestId("request-tab-scripts").click();

	const editor = page
		.getByTestId("request-scripts-editor")
		.locator(".cm-content");
	await editor.fill('lm.request.setHeader("X-Trace", "e2e-42");');
	await page.getByTestId("request-scripts-post").click();
	await page
		.getByTestId("request-scripts-editor")
		.locator(".cm-content")
		.fill(
			'lm.test("Status is 200", () => lm.expect(lm.response.status).to.equal(200));',
		);
	await send(page);

	await expect(page.getByTestId("response-status")).toContainText("200");
	const echo = await echoBody(page);
	const trace = echo.headers.find(([name]) => name.toLowerCase() === "x-trace");
	expect(trace?.[1]).toBe("e2e-42");

	await page.getByTestId("response-tab-tests").click();
	await expect(page.getByTestId("response-test")).toHaveCount(1);
	await expect(page.getByTestId("response-test")).toContainText(
		"Status is 200",
	);
	await expect(page.getByTestId("response-tests-summary")).toContainText("1");
});

test("the API client page has no serious or critical accessibility violations", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("a11y", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	await setUrl(page, `${ECHO_ORIGIN}/cors/a11y`);

	const serious = (await axeViolations(page)).filter(
		(finding) => finding.impact === "serious" || finding.impact === "critical",
	);
	expect(serious).toEqual([]);
});

test("the tab menu duplicates a tab and closes the others", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("tabmenu", uniqueSuffix()));
	await openApiClient(page);
	await newRequestTab(page);
	const url = `${ECHO_ORIGIN}/cors/tab-menu`;
	await setUrl(page, url);

	const tabs = page.getByTestId("tabbar-tab");
	const menu = page.getByTestId("tabbar-tab-menu");
	await tabs.first().click({ button: "right" });
	await expect(menu).toBeVisible();
	await page.getByTestId("tabbar-menu-duplicate").click();
	// The closing menu fades out before the next one opens.
	await expect(menu).toHaveCount(0);
	await expect(tabs).toHaveCount(2);
	await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
	await expect(page.getByTestId("request-url")).toHaveValue(url);

	await tabs.nth(1).click({ button: "right" });
	await page.getByTestId("tabbar-menu-close-others").click();
	// The first tab holds an unsent edit: one question before it goes.
	await page.getByTestId("modal-unsaved-discard").click();
	await expect(tabs).toHaveCount(1);

	await page.getByTestId("tabbar-more").click();
	await expect(page.getByTestId("tabbar-more-tab")).toHaveCount(1);
	// Checked with the menu closed: an open menu hides the page from
	// assistive tech on purpose (focus stays in the menu).
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("tabbar-more-menu")).toHaveCount(0);
	expect(await axeViolations(page)).toEqual([]);
});
