import { expect, test } from "@playwright/test";
import { WEB_ORIGIN } from "../support/ports.js";
import { uniqueSuffix } from "../support/session.js";
import {
	expectSandboxedAnswer,
	mockRootOf,
	openEndpointTab,
	seedProjectWithUsers,
} from "../support/traffic-ui.js";

test("an inbox answers the sender with its own response and its calls open in the request log", async ({
	page,
	request,
}) => {
	const { usersUrl } = await seedProjectWithUsers(page, "inbox");
	await openEndpointTab(page, "inbox");

	const name = `stripe-${uniqueSuffix()}`;
	await page.getByTestId("inbox-new").click();
	await expect(page.getByTestId("modal-new-inbox")).toBeVisible();
	await page.getByTestId("inbox-form-name").fill(name);
	await page.getByTestId("inbox-form-status").fill("202");
	await page.getByTestId("modal-submit").click();
	await expect(page.getByTestId("modal-new-inbox")).toBeHidden();

	const item = page.getByTestId(`inbox-item-${name}`);
	await expect(item).toBeVisible();
	await expect(item.getByTestId("inbox-item-response")).toContainText("202");

	// Same host as the mock: `{secret}` of the project, then `/_inbox/<name>`.
	const inboxUrl = `${mockRootOf(usersUrl)}/_inbox/${name}`;
	await expect(item.getByTestId("inbox-item-url")).toHaveValue(inboxUrl);

	const reply = await request.post(inboxUrl, {
		headers: { "content-type": "application/json" },
		data: { type: "payment_intent.succeeded" },
	});
	expect(reply.status()).toBe(202);
	expect(await reply.json()).toEqual({ received: true });
	expectSandboxedAnswer(reply.headers());

	// The request count is read when the inbox list loads and does not update
	// live (only the request log does), so the check reloads the page first.
	await page.reload();
	await expect(page.getByTestId("project-detail")).toBeVisible();
	await openEndpointTab(page, "inbox");
	const count = page
		.getByTestId(`inbox-item-${name}`)
		.getByTestId("inbox-item-view-log");
	await expect(count).toContainText("1 request");
	await count.click();

	await expect(page.getByTestId("project-detail-request-log")).toBeVisible();
	await expect(page.getByTestId("request-log-filter-source")).toHaveValue(
		"inbox",
	);
	const rows = page.getByTestId("request-log-row");
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText(`Inbox · ${name}`);
	await expect(rows.first().getByTestId("request-log-path")).toHaveText(
		`/_inbox/${name}`,
	);
});

test("an inbox offers only JSON and plain text, and the API refuses HTML at creation", async ({
	page,
}) => {
	await seedProjectWithUsers(page, "inbox-type");
	await openEndpointTab(page, "inbox");

	await page.getByTestId("inbox-new").click();
	await expect(page.getByTestId("modal-new-inbox")).toBeVisible();
	const options = await page
		.getByTestId("inbox-form-content-type")
		.locator("option")
		.allTextContents();
	expect(options).toEqual(["application/json", "text/plain"]);
	await page.getByTestId("modal-cancel").click();
	await expect(page.getByTestId("modal-new-inbox")).toBeHidden();

	// The same rule holds for the API, which is what the form posts to.
	const projectId = /\/projects\/([^/?#]+)/.exec(
		new URL(page.url()).pathname,
	)?.[1];
	expect(projectId).toBeTruthy();
	const created = await page.request.post(
		`/api/v1/projects/${projectId}/inboxes`,
		{
			headers: { origin: WEB_ORIGIN },
			data: {
				name: `html-${uniqueSuffix()}`,
				response: { contentType: "text/html" },
			},
		},
	);
	expect(created.status()).toBe(400);
	expect(await created.json()).toMatchObject({
		error: { code: "VALIDATION_ERROR" },
	});
});
